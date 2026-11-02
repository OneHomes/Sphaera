import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncSakariWebhook } from "@/lib/sakariWebhook";

// Sakari SMS -> Sphaera lead timeline (see lib/sakariWebhook.ts for why
// this can't come through HubSpot). Public by necessity, like the HubSpot
// webhook. Sakari doesn't sign its notifications, so the URL itself
// carries a shared secret: register the webhook in Sakari (Account
// Settings -> API -> Create Webhook, events "message-sent" and
// "message-received") as
//   https://apex.sphaera.tech/api/webhooks/sakari?token=<SAKARI_WEBHOOK_TOKEN>
// with SAKARI_WEBHOOK_TOKEN set to the same random value in the app's
// environment settings.

function tokenMatches(given: string | null): boolean {
  const expected = process.env.SAKARI_WEBHOOK_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lets an Admin confirm the endpoint is deployed and its token is set (never reveals the token). */
export async function GET() {
  return NextResponse.json({ ok: true, tokenConfigured: Boolean(process.env.SAKARI_WEBHOOK_TOKEN) });
}

export async function POST(request: Request) {
  if (!tokenMatches(new URL(request.url).searchParams.get("token"))) {
    console.warn(`Sakari webhook rejected: ${process.env.SAKARI_WEBHOOK_TOKEN ? "wrong or missing token" : "SAKARI_WEBHOOK_TOKEN not set"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Sakari may batch several notifications in one call.
  const events = Array.isArray(body) ? body : [body];
  const outcomes = [];
  for (const event of events) {
    try {
      const outcome = await syncSakariWebhook(event);
      console.log(`Sakari webhook: ${outcome.status}${"reason" in outcome ? ` (${outcome.reason})` : ""}`);
      outcomes.push(outcome.status);
    } catch (err) {
      console.error("Sakari webhook: failed to process event:", err);
      outcomes.push("error");
    }
  }

  // Always 200 once authenticated, so one bad event doesn't make Sakari
  // retry (and duplicate) the rest of the batch.
  return NextResponse.json({ received: events.length, outcomes });
}
