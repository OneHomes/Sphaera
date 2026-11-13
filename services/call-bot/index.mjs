// Sphaera call bot: runs on the video VM next to LiveKit.
//
// Every few seconds it looks at the live rooms. For each video call it
//   - joins hidden (nobody sees it), mixes everyone's audio into one Azure
//     Speech stream (billed once, not once per person) and labels each
//     sentence with whoever was loudest while it was said;
//   - starts the recording (480p MP4 to Azure Blob, via LiveKit Egress)
//     once the agent and the client are both in;
//   - tells Sphaera what happened (recording started/ended, transcript
//     lines, call finished). Sphaera writes the notes from there.
//
// Requests to Sphaera are signed with the LiveKit API key and secret (a
// short JWT carrying the body's SHA-256), so no extra secret is needed.

import { createHash } from "node:crypto";
import { AudioStream, Room, RoomEvent, TrackKind, dispose } from "@livekit/rtc-node";
import {
  AccessToken,
  AudioCodec,
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptions,
  RoomServiceClient,
  VideoCodec,
} from "livekit-server-sdk";
import sdk from "microsoft-cognitiveservices-speech-sdk";

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing setting ${name}`);
  return v;
};

const LIVEKIT_URL = env("LIVEKIT_URL", "ws://localhost:7880");
const LIVEKIT_HTTP = LIVEKIT_URL.replace(/^ws/, "http");
const API_KEY = env("LIVEKIT_API_KEY");
const API_SECRET = env("LIVEKIT_API_SECRET");
const SPHAERA_URL = env("SPHAERA_BOT_URL", "https://apex.sphaera.tech/api/video/bot");
const SPEECH_KEY = env("AZURE_SPEECH_KEY");
const SPEECH_REGION = env("AZURE_SPEECH_REGION", "centralindia");
// Azure picks the language per sentence from this list (max 10). Urdu is
// ur-IN: Azure speech-to-text has no ur-PK; it is the same language and script.
const LANGUAGES = env("SPEECH_LANGUAGES", "en-GB,ur-IN").split(",").map((s) => s.trim()).filter(Boolean);
const RECORD = env("RECORDING_ENABLED", "true") === "true";
// Which speech-to-text: "azure" (Azure Speech, live, one mixed stream per
// call) or "openai" (gpt-4o-mini-transcribe on Azure, per utterance).
// Switch with deploy/switch-transcriber.sh; the other path stays intact.
const TRANSCRIBER = env("TRANSCRIBER", "azure");
if (!["azure", "openai"].includes(TRANSCRIBER)) throw new Error(`TRANSCRIBER must be azure or openai, not ${TRANSCRIBER}`);
const TRANSCRIBE_DEPLOYMENT = process.env.TRANSCRIBE_DEPLOYMENT || "gpt-4o-mini-transcribe";
const TRANSCRIBE_KEY = TRANSCRIBER === "openai" ? env("TRANSCRIBE_KEY") : "";
const TRANSCRIBE_URL = (() => {
  if (TRANSCRIBER !== "openai") return "";
  const base = env("TRANSCRIBE_ENDPOINT").replace(/\/+$/, "");
  return base.includes("/audio/transcriptions") ? base : `${base}/openai/v1/audio/transcriptions`;
})();
const BOT_IDENTITY = "sphaera-bot";
const TICK_MS = 4000;
// Leave once nobody (agent or client) has been in the room this long.
const EMPTY_GRACE_MS = 20_000;

const rooms = new RoomServiceClient(LIVEKIT_HTTP, API_KEY, API_SECRET);
const egress = new EgressClient(LIVEKIT_HTTP, API_KEY, API_SECRET);

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------------------------------------------------------------- Sphaera

const outbox = [];

async function post(event) {
  const body = JSON.stringify(event);
  const at = new AccessToken(API_KEY, API_SECRET, { identity: BOT_IDENTITY, ttl: "5m" });
  at.sha256 = createHash("sha256").update(body).digest("base64");
  const res = await fetch(SPHAERA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await at.toJwt()}` },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Sphaera answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Events go out in order; a failed one is retried before anything after it.
function send(event) {
  outbox.push({ event, tries: 0 });
}

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    // Transcript lines that queued up together go as one request.
    while (outbox.length) {
      const head = outbox[0];
      if (head.event.type === "transcript") {
        const batch = [];
        while (outbox.length && outbox[0].event.type === "transcript" && outbox[0].event.room === head.event.room && batch.length < 50) {
          batch.push(...outbox.shift().event.segments);
        }
        try {
          await post({ type: "transcript", room: head.event.room, segments: batch });
        } catch (err) {
          log("transcript send failed, will retry:", err.message);
          outbox.unshift({ event: { type: "transcript", room: head.event.room, segments: batch }, tries: head.tries + 1 });
          break;
        }
        continue;
      }
      try {
        await post(head.event);
        outbox.shift();
      } catch (err) {
        head.tries += 1;
        log(`${head.event.type} send failed (try ${head.tries}):`, err.message);
        if (head.tries >= 30) outbox.shift();
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

// ---------------------------------------------------------------- Speech

function recognizerFor(onText) {
  // Switching language mid-call (continuous language ID) needs the v2 endpoint.
  const speechConfig =
    LANGUAGES.length > 1
      ? sdk.SpeechConfig.fromEndpoint(new URL(`wss://${SPEECH_REGION}.stt.speech.microsoft.com/speech/universal/v2`), SPEECH_KEY)
      : sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
  speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
  speechConfig.outputFormat = sdk.OutputFormat.Simple;
  const push = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
  const audio = sdk.AudioConfig.fromStreamInput(push);
  const recognizer =
    LANGUAGES.length > 1
      ? sdk.SpeechRecognizer.FromConfig(speechConfig, sdk.AutoDetectSourceLanguageConfig.fromLanguages(LANGUAGES), audio)
      : (speechConfig.speechRecognitionLanguage = LANGUAGES[0], new sdk.SpeechRecognizer(speechConfig, audio));

  recognizer.recognized = (_s, e) => {
    if (e.result.reason !== sdk.ResultReason.RecognizedSpeech || !e.result.text?.trim()) return;
    let language = LANGUAGES[0];
    try {
      language = sdk.AutoDetectSourceLanguageResult.fromResult(e.result).language || language;
    } catch {}
    onText(e.result.text.trim(), language, e.result.offset ?? 0, e.result.duration ?? 0);
  };
  recognizer.canceled = (_s, e) => {
    if (e.reason === sdk.CancellationReason.Error) log("speech error:", e.errorCode, e.errorDetails);
  };
  recognizer.startContinuousRecognitionAsync(undefined, (err) => log("speech start failed:", err));
  return {
    write: (int16) => push.write(int16.buffer.slice(int16.byteOffset, int16.byteOffset + int16.byteLength)),
    close: () => {
      push.close();
      recognizer.stopContinuousRecognitionAsync(() => recognizer.close(), () => recognizer.close());
    },
  };
}

// ---------------------------------------------------------------- Calls

function roleOf(identity, metadata) {
  try {
    const role = JSON.parse(metadata || "{}").role;
    if (role) return role;
  } catch {}
  if (identity.startsWith("agent-")) return "agent";
  if (identity.startsWith("client-")) return "client";
  return "other";
}

const isCallRoom = (name) => name.startsWith("call-") && !name.endsWith("-coach");
const isPerson = (p) => !p.permission?.hidden && (p.identity.startsWith("agent-") || p.identity.startsWith("client-"));

/** roomName -> { room, speakers, people, mix, emptySince, recording, closing, speechSeconds } */
const calls = new Map();

async function join(roomName) {
  const at = new AccessToken(API_KEY, API_SECRET, { identity: BOT_IDENTITY, name: "Sphaera notes", ttl: "12h" });
  at.addGrant({ room: roomName, roomJoin: true, hidden: true, canPublish: false, canSubscribe: true, canPublishData: true });
  const room = new Room();
  const call = { room, speakers: new Map(), people: new Map(), mix: null, pending: new Set(), tokens: { audio: 0, text: 0, output: 0 }, lastText: "", emptySince: null, recording: false, closing: false, speechSeconds: 0 };
  calls.set(roomName, call);

  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    if (track.kind !== TrackKind.KIND_AUDIO || !isPerson({ identity: participant.identity })) return;
    startSpeaker(roomName, call, track, participant);
  });
  room.on(RoomEvent.TrackUnsubscribed, (_track, pub) => stopSpeaker(call, pub.sid));
  room.on(RoomEvent.Disconnected, () => {
    if (!call.closing) finish(roomName, "disconnected");
  });

  try {
    await room.connect(LIVEKIT_URL, await at.toJwt(), { autoSubscribe: true, dynacast: false });
    log("joined", roomName);
  } catch (err) {
    calls.delete(roomName);
    log("join failed", roomName, err.message);
  }
}

// ---------------------------------------------------------------- Mixing
// Azure bills per audio stream, so each call's voices are mixed into ONE
// stream: half the cost of a stream per person. Who said a sentence comes
// from our own per-person audio, not Azure's guess: the person whose audio
// was loudest while the sentence was spoken.
const RATE = 16000;
const BLOCK = RATE / 10; // mix in 100 ms blocks
const TICKS_PER_BLOCK = 1_000_000; // Azure offsets are in 100 ns ticks
const MAX_BUFFER = RATE * 2; // a person's audio more than 2 s behind is dropped
const KEEP_BLOCKS = 6000; // remember 10 minutes of who-was-loud

function startMix(roomName, call) {
  if (call.mix) return;
  const mix = { blocks: 0, due: 0, last: Date.now(), energy: new Map(), wall: new Map(), timer: null, speech: null };
  mix.speech = recognizerFor((text, language, offset, duration) => {
    const who = speakerAt(call, mix, offset, duration);
    const startBlock = Math.floor(offset / TICKS_PER_BLOCK);
    const at = new Date(mix.wall.get(startBlock) ?? Date.now()).toISOString();
    const segment = { identity: who.identity, name: who.name, role: who.role, text, language, at };
    send({ type: "transcript", room: roomName, segments: [segment] });
    // Live captions for the Admin's monitor screen.
    call.room.localParticipant
      ?.publishData(new TextEncoder().encode(JSON.stringify(segment)), { reliable: true, topic: "transcript" })
      .catch(() => {});
  });
  // Driven by the clock, not by the streams: a muted or stalled person never
  // holds up the others; their share of a block is just silence.
  mix.timer = setInterval(() => {
    const now = Date.now();
    mix.due += (now - mix.last) / 100;
    mix.last = now;
    // Nobody with a microphone in the room: send nothing (nothing billed).
    if (!call.speakers.size) {
      mix.due = 0;
      return;
    }
    while (mix.due >= 1) {
      mixBlock(call, mix);
      mix.due -= 1;
    }
    if (mix.due > 50) mix.due = 0; // the process stalled for >5 s: don't flood
  }, 50);
  call.mix = mix;
}

function mixBlock(call, mix) {
  const sum = new Int32Array(BLOCK);
  const energies = [];
  for (const [key, sp] of call.speakers) {
    const take = Math.min(sp.buffered, BLOCK);
    let energy = 0;
    for (let i = 0; i < take; ) {
      const head = sp.queue[0];
      const n = Math.min(head.length - sp.pos, take - i);
      for (let j = 0; j < n; j++) {
        const v = head[sp.pos + j];
        sum[i + j] += v;
        energy += v * v;
      }
      i += n;
      sp.pos += n;
      if (sp.pos >= head.length) {
        sp.queue.shift();
        sp.pos = 0;
      }
    }
    sp.buffered -= take;
    if (energy) energies.push([key, energy]);
  }
  const pcm = new Int16Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) pcm[i] = Math.max(-32768, Math.min(32767, sum[i]));
  mix.speech.write(pcm);
  if (energies.length) mix.energy.set(mix.blocks, energies);
  mix.wall.set(mix.blocks, Date.now());
  mix.energy.delete(mix.blocks - KEEP_BLOCKS);
  mix.wall.delete(mix.blocks - KEEP_BLOCKS);
  mix.blocks++;
  // Azure bills by audio sent; reported with call_finished.
  call.speechSeconds += 0.1;
}

function speakerAt(call, mix, offset, duration) {
  const from = Math.floor(offset / TICKS_PER_BLOCK);
  const to = Math.ceil((offset + duration) / TICKS_PER_BLOCK);
  const totals = new Map();
  for (let b = from; b <= to; b++) for (const [k, e] of mix.energy.get(b) ?? []) totals.set(k, (totals.get(k) ?? 0) + e);
  let best = null;
  for (const [k, e] of totals) if (!best || e > best[1]) best = [k, e];
  return (best && call.people.get(best[0])) ?? { identity: "unknown", name: "Unknown speaker", role: "other" };
}

function closeMix(call) {
  if (!call.mix) return;
  clearInterval(call.mix.timer);
  try {
    call.mix.speech.close();
  } catch {}
  call.mix = null;
}

// ---------------------------------------------------------------- OpenAI (gpt-4o-mini-transcribe)
// TRANSCRIBER=openai: each person's audio is cut into utterances (a simple
// voice-activity detector: speech, then 0.8 s of quiet), and only those are
// sent to the transcribe model on Azure. Silence is never sent, and each
// utterance belongs to one person, so the names are always right. Text
// arrives a few seconds after each sentence, so live captions still work.
const VAD_END_MS = 800; // this much quiet ends an utterance
const VAD_MAX_MS = 25_000; // never send more than this in one go
const VAD_MIN_SPEECH_MS = 300; // shorter blips (coughs, clicks) are dropped
const VAD_PREROLL_MS = 300; // keep the start of the first word
const MAX_IN_FLIGHT = 6;

let inFlight = 0;
const waiting = [];
const slot = () => (inFlight < MAX_IN_FLIGHT ? (inFlight++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
const release = () => (waiting.length ? waiting.shift()() : inFlight--);

function wav(pcm) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const TRANSCRIBE_PROMPT =
  "A video call between a real-estate agent and a client. They speak English and Urdu, often mixed. " +
  "Write Urdu in Urdu script and English in English. Property terms: flat, apartment, villa, plot, bedroom, budget, dirham, payment plan.";

async function transcribeClip(pcm, previousText) {
  const form = new FormData();
  form.append("model", TRANSCRIBE_DEPLOYMENT);
  form.append("file", new Blob([wav(pcm)], { type: "audio/wav" }), "clip.wav");
  form.append("response_format", "json");
  form.append("prompt", previousText ? `${TRANSCRIBE_PROMPT}\nEarlier: ${previousText.slice(-300)}` : TRANSCRIBE_PROMPT);
  for (let attempt = 0; ; attempt++) {
    await slot();
    let res;
    try {
      res = await fetch(TRANSCRIBE_URL, { method: "POST", headers: { "api-key": TRANSCRIBE_KEY }, body: form, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      res = { ok: false, status: 0, headers: new Headers(), text: async () => err.message };
    } finally {
      release();
    }
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500 || res.status === 0;
    if (!retryable || attempt >= 3) throw new Error(`transcribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

function utteranceCutter(roomName, call, key) {
  let floor = 200; // running noise floor (RMS)
  let active = null; // { chunks, samples, speechMs, quietMs, startedAt }
  const preroll = [];
  let prerollSamples = 0;

  function sendUtterance(u) {
    if (u.speechMs < VAD_MIN_SPEECH_MS) return;
    const pcm = new Int16Array(u.samples);
    let o = 0;
    for (const c of u.chunks) {
      pcm.set(c, o);
      o += c.length;
    }
    const seconds = u.samples / RATE;
    const who = call.people.get(key);
    const job = transcribeClip(pcm, call.lastText)
      .then((r) => {
        call.speechSeconds += seconds;
        if (r.usage) {
          call.tokens.audio += r.usage.input_token_details?.audio_tokens ?? r.usage.input_tokens ?? 0;
          call.tokens.text += r.usage.input_token_details?.text_tokens ?? 0;
          call.tokens.output += r.usage.output_tokens ?? 0;
        }
        const text = (r.text ?? "").trim();
        if (!text) return;
        call.lastText = text;
        const language = /[؀-ۿ]/.test(text) ? "ur" : "en";
        const segment = { identity: who.identity, name: who.name, role: who.role, text, language, at: new Date(u.startedAt).toISOString() };
        send({ type: "transcript", room: roomName, segments: [segment] });
        call.room.localParticipant
          ?.publishData(new TextEncoder().encode(JSON.stringify(segment)), { reliable: true, topic: "transcript" })
          .catch(() => {});
      })
      .catch((err) => log("transcribe failed", roomName, err.message))
      .finally(() => call.pending.delete(job));
    call.pending.add(job);
  }

  return {
    push(frame) {
      const ms = (frame.length / RATE) * 1000;
      let sq = 0;
      for (let i = 0; i < frame.length; i++) sq += frame[i] * frame[i];
      const rms = Math.sqrt(sq / frame.length);
      const loud = rms > Math.max(350, floor * 3);
      if (!active) {
        if (!loud) floor = floor * 0.98 + rms * 0.02;
        preroll.push(frame);
        prerollSamples += frame.length;
        while (prerollSamples > (RATE * VAD_PREROLL_MS) / 1000 && preroll.length > 1) prerollSamples -= preroll.shift().length;
        if (!loud) return;
        active = { chunks: [...preroll], samples: prerollSamples, speechMs: ms, quietMs: 0, startedAt: Date.now() - (prerollSamples / RATE) * 1000 };
        preroll.length = 0;
        prerollSamples = 0;
        return;
      }
      active.chunks.push(frame);
      active.samples += frame.length;
      if (loud) {
        active.speechMs += ms;
        active.quietMs = 0;
      } else active.quietMs += ms;
      if (active.quietMs >= VAD_END_MS || (active.samples / RATE) * 1000 >= VAD_MAX_MS) this.flush();
    },
    flush() {
      if (active) sendUtterance(active);
      active = null;
    },
  };
}

function startSpeaker(roomName, call, track, participant) {
  const key = track.sid;
  if (call.speakers.has(key)) return;
  const role = roleOf(participant.identity, participant.metadata);
  const name = participant.name || participant.identity;
  call.people.set(key, { identity: participant.identity, name, role });
  const stream = new AudioStream(track, { sampleRate: RATE, numChannels: 1 });
  const speaker = { stream, queue: [], pos: 0, buffered: 0, done: false, cutter: null };
  call.speakers.set(key, speaker);
  if (TRANSCRIBER === "openai") speaker.cutter = utteranceCutter(roomName, call, key);
  else startMix(roomName, call);
  log("transcribing", name, `(${role})`, "in", roomName);
  (async () => {
    try {
      for await (const frame of stream) {
        if (speaker.done) break;
        if (speaker.cutter) {
          speaker.cutter.push(frame.data);
          continue;
        }
        speaker.queue.push(frame.data);
        speaker.buffered += frame.data.length;
        while (speaker.buffered > MAX_BUFFER && speaker.queue.length > 1) {
          speaker.buffered -= speaker.queue.shift().length - speaker.pos;
          speaker.pos = 0;
        }
      }
    } catch (err) {
      log("audio stream ended with error:", err.message);
    } finally {
      stopSpeaker(call, key);
    }
  })();
}

function stopSpeaker(call, key) {
  const speaker = call.speakers.get(key);
  if (!speaker || speaker.done) return;
  speaker.done = true;
  call.speakers.delete(key);
  speaker.cutter?.flush();
  speaker.stream.cancel().catch(() => {});
}

async function startRecording(roomName, call) {
  call.recording = true;
  try {
    const active = await egress.listEgress({ roomName, active: true });
    if (active.length) {
      for (const e of active) send({ type: "recording_started", room: roomName, egressId: e.egressId, path: e.fileResults?.[0]?.filename ?? null });
      return;
    }
    const filepath = `${roomName}/${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
    const info = await egress.startRoomCompositeEgress(
      roomName,
      new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath }),
      {
        layout: "grid",
        encodingOptions: new EncodingOptions({
          width: 854,
          height: 480,
          depth: 24,
          framerate: 20,
          videoCodec: VideoCodec.H264_MAIN,
          videoBitrate: 700,
          keyFrameInterval: 4,
          audioCodec: AudioCodec.AAC,
          audioBitrate: 64,
          audioFrequency: 44100,
        }),
      }
    );
    log("recording", roomName, info.egressId);
    send({ type: "recording_started", room: roomName, egressId: info.egressId, path: filepath });
  } catch (err) {
    call.recording = false; // try again next tick
    log("recording start failed", roomName, err.message);
  }
}

async function finish(roomName, why) {
  const call = calls.get(roomName);
  if (!call || call.closing) return;
  call.closing = true;
  log("call finished", roomName, why);
  for (const key of [...call.speakers.keys()]) stopSpeaker(call, key);
  closeMix(call);
  await call.room.disconnect().catch(() => {});
  calls.delete(roomName);
  // Let the last sentences finish transcribing so the notes include them.
  if (call.pending.size) await Promise.race([Promise.allSettled([...call.pending]), new Promise((r) => setTimeout(r, 60_000))]);
  send({
    type: "call_finished",
    room: roomName,
    transcriber: TRANSCRIBER === "openai" ? TRANSCRIBE_DEPLOYMENT : "azure-speech-realtime",
    speechSeconds: Math.round(call.speechSeconds),
    tokens: TRANSCRIBER === "openai" ? call.tokens : undefined,
  });

  // Stop the recording (it would otherwise run until the room closes),
  // then wait for the upload to finish and report the file.
  let list = [];
  try {
    list = await egress.listEgress({ roomName });
    for (const e of list.filter((e) => e.status <= EgressStatus.EGRESS_ACTIVE)) await egress.stopEgress(e.egressId).catch(() => {});
  } catch (err) {
    log("egress list failed", err.message);
  }
  for (let i = 0; i < 60; i++) {
    try {
      list = await egress.listEgress({ roomName });
    } catch {
      break;
    }
    if (list.every((e) => e.status > EgressStatus.EGRESS_ENDING)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  for (const e of list) {
    const file = e.fileResults?.[0];
    send({
      type: "recording_ended",
      room: roomName,
      egressId: e.egressId,
      status: e.status === EgressStatus.EGRESS_COMPLETE ? "ready" : "failed",
      path: file?.filename ?? null,
      durationSec: file?.duration ? Math.round(Number(file.duration) / 1e9) : null,
      sizeBytes: file?.size ? Number(file.size) : null,
      error: e.error || null,
    });
  }
}

async function tick() {
  let live;
  try {
    live = (await rooms.listRooms()).filter((r) => isCallRoom(r.name));
  } catch (err) {
    log("listRooms failed:", err.message);
    return;
  }
  const liveNames = new Set(live.map((r) => r.name));

  for (const r of live) {
    let people = [];
    try {
      people = (await rooms.listParticipants(r.name)).filter(isPerson);
    } catch {
      continue;
    }
    let call = calls.get(r.name);
    if (!call && people.length) {
      await join(r.name);
      call = calls.get(r.name);
    }
    if (!call || call.closing) continue;
    if (people.length) call.emptySince = null;
    else if (!call.emptySince) call.emptySince = Date.now();
    else if (Date.now() - call.emptySince > EMPTY_GRACE_MS) {
      finish(r.name, "everyone left");
      continue;
    }
    const roles = new Set(people.map((p) => roleOf(p.identity, p.metadata)));
    // Not awaited: Egress can take many seconds to answer (or time out when
    // the server is full), and that must not hold up every other room.
    if (RECORD && !call.recording && roles.has("agent") && roles.has("client")) startRecording(r.name, call);
  }

  // Rooms that closed (call ended for everyone from Sphaera).
  for (const name of calls.keys()) if (!liveNames.has(name)) finish(name, "room closed");
}

log(`call bot up: ${LIVEKIT_URL}, transcriber ${TRANSCRIBER === "openai" ? TRANSCRIBE_DEPLOYMENT : `azure (${LANGUAGES.join("/")})`}, recording ${RECORD ? "on" : "off"}`);
// One tick at a time. Overlapping ticks raced: an older tick, holding a
// room list from before a new room opened, saw the bot in that room and
// ended the call as "room closed" (found by the 10-call load test).
let ticking = false;
setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await tick();
  } catch (err) {
    log("tick failed:", err.message);
  } finally {
    ticking = false;
  }
}, TICK_MS);
setInterval(() => flush().catch(() => {}), 2000);

// A restart must not end anyone's call: leave the rooms but keep the
// recordings running. The next start rejoins and finds them again.
async function shutdown() {
  log("shutting down");
  for (const call of calls.values()) {
    call.closing = true;
    for (const key of [...call.speakers.keys()]) stopSpeaker(call, key);
    closeMix(call);
    await call.room.disconnect().catch(() => {});
  }
  await flush().catch(() => {});
  await dispose().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
