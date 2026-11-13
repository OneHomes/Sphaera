// Load test for the video server, run from a dev machine:
//   CALLS=10 MINUTES=5 node --env-file=../../.env.local loadtest.mjs
// Opens CALLS throwaway rooms "call-loadtest-…" (not Sphaera calls, so
// nothing is written to the database). Each has a fake agent and a fake
// client publishing a moving test picture (640x360, 15 fps) and looping
// text-to-speech audio, so the bot transcribes and Egress records every
// room just as it would a real call. Watch the VM while it runs; delete the
// recordings under recordings/call-loadtest-… afterwards.
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import {
  AudioFrame, AudioSource, LocalAudioTrack, LocalVideoTrack, Room, RoomEvent,
  TrackPublishOptions, TrackSource, VideoBufferType, VideoFrame, VideoSource, dispose,
} from "@livekit/rtc-node";
import { VideoEncoding } from "@livekit/rtc-ffi-bindings";

const { LIVEKIT_URL, LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION } = process.env;
const CALLS = Number(process.env.CALLS ?? 10);
const MINUTES = Number(process.env.MINUTES ?? 5);
const RATE = 48000;
const W = 640, H = 360, FPS = 15;
const stamp = Date.now();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

const svc = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), KEY, SECRET);

// Refuse to run over real calls.
const live = (await svc.listRooms()).filter((r) => r.name.startsWith("call-") && !/^call-(loadtest|selftest)-/.test(r.name));
if (live.length) {
  console.error(`Real calls are running (${live.map((r) => r.name).join(", ")}); not starting.`);
  process.exit(1);
}

async function tts(voice, lang, text) {
  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${text}</voice></speak>`;
  const res = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "raw-48khz-16bit-mono-pcm" },
    body: ssml,
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

// 60 precomputed I420 frames: a sliding gradient with a moving block and
// some noise, so the encoders do real work instead of coding a still image.
function makeFrames(seed) {
  const frames = [];
  const ySize = W * H, cSize = (W / 2) * (H / 2);
  for (let f = 0; f < 60; f++) {
    const buf = new Uint8Array(ySize + 2 * cSize);
    const bx = Math.floor((f / 60) * (W - 120)), by = Math.floor(H / 2 - 60 + 40 * Math.sin(f / 9));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = (x + y + f * 6 + seed * 40) & 255;
        if (x >= bx && x < bx + 120 && y >= by && y < by + 120) v = 235;
        buf[y * W + x] = (v + ((Math.random() * 24) | 0)) & 255;
      }
    }
    for (let i = 0; i < cSize; i++) {
      buf[ySize + i] = (128 + seed * 17 + f) & 255;
      buf[ySize + cSize + i] = (128 - seed * 13 + f) & 255;
    }
    frames.push(new VideoFrame(buf, W, H, VideoBufferType.I420));
  }
  return frames;
}

const people = [];
let stopping = false;

async function person(room, identity, name, role, seed, clip) {
  const at = new AccessToken(KEY, SECRET, { identity, name, metadata: JSON.stringify({ role }) });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  const r = new Room();
  await r.connect(LIVEKIT_URL, await at.toJwt(), { autoSubscribe: false, dynacast: false });

  const audio = new AudioSource(RATE, 1);
  const aopts = new TrackPublishOptions();
  aopts.source = TrackSource.SOURCE_MICROPHONE;
  await r.localParticipant.publishTrack(LocalAudioTrack.createAudioTrack("mic", audio), aopts);

  const video = new VideoSource(W, H);
  const vopts = new TrackPublishOptions();
  vopts.source = TrackSource.SOURCE_CAMERA;
  vopts.simulcast = false;
  vopts.videoEncoding = new VideoEncoding({ maxBitrate: BigInt(350_000), maxFramerate: FPS });
  await r.localParticipant.publishTrack(LocalVideoTrack.createVideoTrack("cam", video), vopts);

  const frames = makeFrames(seed);
  let n = 0;
  const timer = setInterval(() => video.captureFrame(frames[n++ % frames.length]), 1000 / FPS);

  // Talk, then stay quiet a while (the other person talks), forever.
  const step = RATE / 100;
  (async () => {
    await new Promise((res) => setTimeout(res, role === "agent" ? 2000 : 9000));
    while (!stopping) {
      for (let i = 0; i < clip.length && !stopping; i += step) {
        const chunk = new Int16Array(step);
        chunk.set(clip.subarray(i, i + step));
        await audio.captureFrame(new AudioFrame(chunk, RATE, 1, step));
      }
      for (let i = 0; i < 700 && !stopping; i++) await audio.captureFrame(new AudioFrame(new Int16Array(step), RATE, 1, step));
    }
  })().catch(() => {});

  const p = { r, timer, room };
  people.push(p);
  return p;
}

const [english, urdu] = await Promise.all([
  tts("en-GB-RyanNeural", "en-GB", "Hello, thanks for joining. Are you still looking for a two bedroom apartment in Dubai Marina?"),
  tts("ur-PK-UzmaNeural", "ur-PK", "جی ہاں، میرا بجٹ تقریباً بیس لاکھ درہم ہے اور مجھے اگلے مہینے تک فلیٹ چاہیے۔"),
]);

const captions = new Map();
const rooms = [];
for (let i = 0; i < CALLS; i++) {
  const room = `call-loadtest-${stamp}-${String(i + 1).padStart(2, "0")}`;
  rooms.push(room);
  await svc.createRoom({ name: room, emptyTimeout: 60 });
  const agent = await person(room, `agent-${i}`, `Load Agent ${i + 1}`, "agent", i * 2, english);
  await person(room, `client-${i}`, `Load Client ${i + 1}`, "client", i * 2 + 1, urdu);
  captions.set(room, 0);
  agent.r.on(RoomEvent.DataReceived, (_payload, _p, _k, topic) => {
    if (topic === "transcript") captions.set(room, captions.get(room) + 1);
  });
  log("started", room);
  await new Promise((res) => setTimeout(res, 3000)); // calls don't all start in the same second
}

log(`all ${CALLS} calls up; holding for ${MINUTES} min`);
const report = setInterval(() => log("captions per room:", [...captions.values()].join(" ")), 30000);
await new Promise((res) => setTimeout(res, MINUTES * 60000));

clearInterval(report);
stopping = true;
log("captions per room:", [...captions.values()].join(" "));
log("ending calls");
for (const p of people) {
  clearInterval(p.timer);
  await p.r.disconnect().catch(() => {});
}
for (const room of rooms) await svc.deleteRoom(room).catch(() => {});
await dispose();
log("done; rooms:", rooms[0], "…", rooms.at(-1));
