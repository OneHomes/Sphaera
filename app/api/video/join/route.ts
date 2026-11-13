import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { guestKeyMatches, guestToken } from "@/lib/video/livekit";
import { isCallOpen, notConfigured } from "@/lib/video/calls";

// Public (no Sphaera account): a client joins through the link the agent
// sent. Requires the link's secret and the client's consent to the call
// being monitored and recorded; the consent is stored with time, IP and
// browser so it can be shown later.
export async function POST(request: Request) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const callId = typeof body.callId === "string" ? body.callId : "";
  const key = typeof body.key === "string" ? body.key : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (!callId || !key) return NextResponse.json({ error: "This link isn't valid" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  if (body.consent !== true) {
    return NextResponse.json({ error: "Please confirm you understand the call will be recorded and transcribed" }, { status: 400 });
  }

  // findUnique by id: not tenant-filtered, since a client has no session.
  const call = await prisma.videoCall.findUnique({ where: { id: callId } });
  if (!call || !guestKeyMatches(key, call.guestKeyHash)) {
    return NextResponse.json({ error: "This link isn't valid" }, { status: 404 });
  }
  if (!isCallOpen(call)) {
    return NextResponse.json({ error: "This call has ended" }, { status: 410 });
  }

  const identity = `client-${randomBytes(6).toString("hex")}`;
  try {
    const tokens = await guestToken(call.roomName, identity, name);
    await prisma.videoCallGuest.create({
      data: {
        organizationId: call.organizationId,
        callId: call.id,
        name,
        identity,
        consentedAt: new Date(),
        ipAddress: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null,
        userAgent: (request.headers.get("user-agent") ?? "").slice(0, 400) || null,
      },
    });
    return NextResponse.json(tokens);
  } catch (err) {
    const res = notConfigured(err);
    if (res) return res;
    throw err;
  }
}
