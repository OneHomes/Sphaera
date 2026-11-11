import { NextResponse } from "next/server";
import { VideoNotConfiguredError } from "./livekit";

// Shared bits for the /api/video/* routes.

// The public origin the client's join link should point at. Behind Azure
// the request URL can carry an internal host, so prefer the forwarded one.
export function publicOrigin(request: Request): string {
  const h = request.headers;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!host) return new URL(request.url).origin;
  const proto = (h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export function joinUrl(origin: string, callId: string, key: string) {
  return `${origin}/meet/${callId}?k=${encodeURIComponent(key)}`;
}

export function isCallOpen(call: { status: string; expiresAt: Date }) {
  return call.status !== "ended" && call.expiresAt.getTime() > Date.now();
}

export function notConfigured(err: unknown) {
  if (err instanceof VideoNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  return null;
}
