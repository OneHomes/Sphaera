import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncSuperchatWebhook } from "@/lib/superchat";

// Superchat (WhatsApp) -> Sphaera lead timeline (see lib/superchat.ts).
// Public by necessity, like the HubSpot and Sakari webhooks. The URL
// carries a shared token (SUPERCHAT_WEBHOOK_TOKEN), and the message itself
// is re-read from Superchat's API with SUPERCHAT_API_KEY rather than taken
// from the notification. Registered by scripts/setup-superchat-webhook.ts as
//   https://apex.sphaera.tech/api/webhooks/superchat?token=<SUPERCHAT_WEBHOOK_TOKEN>

function tokenMatches(given: string | null): boolean {
  const expected = process.env.SUPERCHAT_WEBHOOK_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lets an Admin confirm the endpoint is deployed and configured (never reveals the values). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    tokenConfigured: Boolean(process.env.SUPERCHAT_WEBHOOK_TOKEN),
    apiKeyConfigured: Boolean(process.env.SUPERCHAT_API_KEY),
  });
}

export async function POST(request: Request) {
  if (!tokenMatches(new URL(request.url).searchParams.get("token"))) {
    console.warn(`Superchat webhook rejected: ${process.env.SUPERCHAT_WEBHOOK_TOKEN ? "wrong or missing token" : "SUPERCHAT_WEBHOOK_TOKEN not set"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = Array.isArray(body) ? body : [body];
  const outcomes = [];
  for (const event of events) {
    try {
      const outcome = await syncSuperchatWebhook(event);
      console.log(`Superchat webhook: ${outcome.status}${"reason" in outcome ? ` (${outcome.reason})` : ""}`);
      outcomes.push(outcome.status);
    } catch (err) {
      console.error("Superchat webhook: failed to process event:", err);
      outcomes.push("error");
    }
  }

  // Always 200 once authenticated, so one bad event doesn't make Superchat
  // retry (and duplicate) the rest of the batch.
  return NextResponse.json({ received: events.length, outcomes });
}
