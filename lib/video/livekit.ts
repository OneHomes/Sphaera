import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { AccessToken, RoomServiceClient, TrackSource, type VideoGrant } from "livekit-server-sdk";

// Video calls run on LiveKit (LiveKit Cloud to start; the same open-source
// server can later be self-hosted on Azure with no code change, only these
// three settings). Every permission lives in the tokens issued here: the
// media server enforces them, so a client can't widen its own access.
//
// Rooms per call:
//   <roomName>        the call: agent + client(s); an Admin may join hidden,
//                     subscribe-only (sees and hears, is never listed)
//   <roomName>-coach  "whisper": Admin speaks, agent listens. The client is
//                     never issued a token for it, so the Admin's voice
//                     cannot reach them.

export function liveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export class VideoNotConfiguredError extends Error {
  constructor() {
    super("Video calls aren't set up yet (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)");
  }
}

function config() {
  const c = liveKitConfig();
  if (!c) throw new VideoNotConfiguredError();
  return c;
}

export function coachRoomName(roomName: string) {
  return `${roomName}-coach`;
}

// Calls and their links stop working after this long, ended or not.
export const CALL_LIFETIME_MS = 12 * 60 * 60 * 1000;
const TOKEN_TTL = "4h";

async function token(identity: string, name: string, grant: VideoGrant, metadata?: Record<string, string>) {
  const { apiKey, apiSecret } = config();
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: TOKEN_TTL,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
  at.addGrant(grant);
  return at.toJwt();
}

// Agent: full participant in the call; listen-only in the coaching room.
export async function agentTokens(roomName: string, user: { id: string; name: string }) {
  return {
    url: config().url,
    call: await token(`agent-${user.id}`, user.name, {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    }, { role: "agent" }),
    coach: await token(`agent-${user.id}`, user.name, {
      room: coachRoomName(roomName),
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    }, { role: "agent" }),
  };
}

// Client: a normal participant in the call only.
export async function guestToken(roomName: string, identity: string, name: string) {
  return {
    url: config().url,
    call: await token(identity, name, {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    }, { role: "client" }),
  };
}

// Admin monitor: hidden and subscribe-only in the call; may publish only
// microphone audio, and only in the coaching room.
export async function monitorTokens(roomName: string, user: { id: string; name: string }) {
  return {
    url: config().url,
    call: await token(`monitor-${user.id}`, user.name, {
      room: roomName,
      roomJoin: true,
      hidden: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    }, { role: "monitor" }),
    coach: await token(`monitor-${user.id}`, user.name, {
      room: coachRoomName(roomName),
      roomJoin: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: false,
      canPublishData: false,
    }, { role: "monitor" }),
  };
}

export function roomService() {
  const { url, apiKey, apiSecret } = config();
  return new RoomServiceClient(url.replace(/^ws/, "http"), apiKey, apiSecret);
}

// The client's link carries a random secret; only its hash is stored.
export function newGuestKey() {
  const key = randomBytes(24).toString("base64url");
  return { key, hash: hashGuestKey(key) };
}

export function hashGuestKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function guestKeyMatches(key: string, hash: string) {
  const a = Buffer.from(hashGuestKey(key), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
