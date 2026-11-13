// Self-test for the call bot, run from a dev machine:
//   node --env-file=../../.env.local selftest.mjs
// Opens a throwaway room "call-selftest-…" (not a Sphaera call, so nothing
// is written to the database), puts a fake agent and a fake client in it
// who speak with Azure's text-to-speech voices, and prints the captions
// the bot sends back. The recording it makes lands in the recordings
// container under that room name; delete it afterwards.
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { AudioFrame, AudioSource, LocalAudioTrack, Room, RoomEvent, TrackPublishOptions, TrackSource, dispose } from "@livekit/rtc-node";

const { LIVEKIT_URL, LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION } = process.env;
const room = `call-selftest-${Date.now()}`;
const RATE = 48000;

async function tts(voice, lang, text) {
  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${text}</voice></speak>`;
  const res = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "raw-48khz-16bit-mono-pcm",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

async function person(identity, name, role) {
  const at = new AccessToken(KEY, SECRET, { identity, name, metadata: JSON.stringify({ role }) });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  const r = new Room();
  await r.connect(LIVEKIT_URL, await at.toJwt(), { autoSubscribe: true, dynacast: false });
  const source = new AudioSource(RATE, 1);
  const track = LocalAudioTrack.createAudioTrack("mic", source);
  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_MICROPHONE;
  await r.localParticipant.publishTrack(track, opts);
  return { r, source };
}

async function speak(source, pcm) {
  const step = RATE / 100; // 10 ms frames
  for (let i = 0; i < pcm.length; i += step) {
    const chunk = new Int16Array(step);
    chunk.set(pcm.subarray(i, i + step));
    await source.captureFrame(new AudioFrame(chunk, RATE, 1, step));
  }
  // a second of silence so the sentence ends
  for (let i = 0; i < 100; i++) await source.captureFrame(new AudioFrame(new Int16Array(step), RATE, 1, step));
}

const svc = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), KEY, SECRET);
await svc.createRoom({ name: room, emptyTimeout: 60 });
console.log("room", room);

const [english, urdu] = await Promise.all([
  tts("en-GB-RyanNeural", "en-GB", "Hello, thanks for joining. Are you still looking for a two bedroom apartment in Dubai Marina?"),
  tts("ur-PK-UzmaNeural", "ur-PK", "جی ہاں، میرا بجٹ تقریباً بیس لاکھ درہم ہے اور مجھے اگلے مہینے تک فلیٹ چاہیے۔"),
]);

const agent = await person("agent-selftest", "Test Agent", "agent");
const client = await person("client-selftest", "Test Client", "client");
agent.r.on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
  if (topic === "transcript") console.log("caption:", new TextDecoder().decode(payload));
});

console.log("waiting for the bot and the recording to start…");
await new Promise((r) => setTimeout(r, 15000));
await speak(agent.source, english);
await speak(client.source, urdu);
await new Promise((r) => setTimeout(r, 8000));

console.log("leaving; the bot should finish the call and stop the recording");
await agent.r.disconnect();
await client.r.disconnect();
await svc.deleteRoom(room).catch(() => {});
await dispose();
console.log("done:", room);
