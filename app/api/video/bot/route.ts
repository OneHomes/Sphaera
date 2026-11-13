import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { prisma, tenantContext } from "@/lib/prisma";
import { VIDEO_CALLS_ENABLED } from "@/lib/video/flag";
import { liveKitConfig } from "@/lib/video/livekit";
import { generateCallNotes } from "@/lib/video/notes";

// Called only by the Sphaera call bot on the video server
// (services/call-bot). It signs each request with the LiveKit API key and
// secret: a short-lived JWT whose sha256 claim is the body's hash, so a
// request can't be forged or altered without the secret.
export const maxDuration = 60;

type Segment = { identity: string; name: string; role: string; text: string; language?: string; at: string };
type BotEvent =
  | { type: "recording_started"; room: string; egressId: string; path: string | null }
  | {
      type: "recording_ended";
      room: string;
      egressId: string;
      status: "ready" | "failed";
      path: string | null;
      durationSec: number | null;
      sizeBytes: number | null;
      error: string | null;
    }
  | { type: "transcript"; room: string; segments: Segment[] }
  | { type: "call_finished"; room: string };

async function verified(request: Request): Promise<BotEvent | null> {
  const cfg = liveKitConfig();
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!cfg || !auth) return null;
  const body = await request.text();
  try {
    const claims = await new TokenVerifier(cfg.apiKey, cfg.apiSecret).verify(auth);
    const expected = Buffer.from(createHash("sha256").update(body).digest("base64"));
    const given = Buffer.from(claims.sha256 ?? "");
    if (claims.sub !== "sphaera-bot" || expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return JSON.parse(body) as BotEvent;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const event = await verified(request);
  if (!event) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The bot knows rooms, not calls. findUnique: not tenant-filtered, the
  // bot has no session; everything after runs in the call's own tenant.
  const call = await prisma.videoCall.findUnique({ where: { roomName: event.room } });
  if (!call?.organizationId) return NextResponse.json({ ok: true, ignored: "unknown room" });

  return tenantContext.run({ organizationId: call.organizationId }, async () => {
    switch (event.type) {
      case "recording_started":
        await prisma.videoCallRecording.upsert({
          where: { egressId: event.egressId },
          create: { callId: call.id, egressId: event.egressId, blobPath: event.path, status: "recording" },
          update: {},
        });
        break;

      case "recording_ended":
        await prisma.videoCallRecording.upsert({
          where: { egressId: event.egressId },
          create: {
            callId: call.id,
            egressId: event.egressId,
            blobPath: event.path,
            status: event.status,
            durationSec: event.durationSec,
            sizeBytes: event.sizeBytes,
            error: event.error?.slice(0, 1000) ?? null,
            endedAt: new Date(),
          },
          update: {
            blobPath: event.path ?? undefined,
            status: event.status,
            durationSec: event.durationSec,
            sizeBytes: event.sizeBytes,
            error: event.error?.slice(0, 1000) ?? null,
            endedAt: new Date(),
          },
        });
        break;

      case "transcript": {
        const rows = (event.segments ?? [])
          .filter((s) => typeof s.text === "string" && s.text.trim())
          .slice(0, 200)
          .map((s) => ({
            callId: call.id,
            speakerIdentity: String(s.identity).slice(0, 190),
            speakerName: String(s.name).slice(0, 190),
            speakerRole: ["agent", "client"].includes(s.role) ? s.role : "other",
            text: s.text.trim(),
            language: s.language ? String(s.language).slice(0, 20) : null,
            spokenAt: isNaN(Date.parse(s.at)) ? new Date() : new Date(s.at),
          }));
        if (rows.length) await prisma.videoCallTranscriptSegment.createMany({ data: rows });
        break;
      }

      case "call_finished":
        await generateCallNotes(call.id);
        break;
    }
    return NextResponse.json({ ok: true });
  });
}
