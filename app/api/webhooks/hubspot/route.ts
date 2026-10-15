import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncHubSpotContactFromWebhook } from "@/lib/hubspotWebhook";
import { syncHubSpotEngagementFromWebhook } from "@/lib/hubspotEngagementWebhook";

// Real-time HubSpot -> Sphaera sync. HubSpot calls this the instant a
// contact is created, OR a call/email/meeting/note/task is created or
// edited on a contact that's already a lead here — subscribe to
// "Contact creation" plus, for each engagement type, both "creation" and
// "propertyChange" on this Private App's Webhooks tab, target URL
// https://apex.sphaera.tech/api/webhooks/hubspot. No session/login here —
// this is a public endpoint by necessity, so HubSpot's own request
// signature is the auth mechanism instead.
//
// Signature verification per HubSpot's v3 scheme: HMAC-SHA256 of
// `${method}${uri}${body}${timestamp}` using the Private App's "Client
// secret" (shown on the app's Auth tab, NOT the access token), base64
// encoded, compared to the X-HubSpot-Signature-v3 header. Requests older
// than 5 minutes are rejected (replay protection).

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

function verifySignature(method: string, url: string, body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (!secret) return false;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_REQUEST_AGE_MS) return false;

  const sourceString = `${method}${url}${body}${timestamp}`;
  const expected = createHmac("sha256", secret).update(sourceString).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

type HubSpotWebhookEvent = {
  eventId: number;
  subscriptionType: string; // e.g. "contact.creation"
  objectId: number;
  occurredAt: number;
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("X-HubSpot-Signature-v3");
  const timestamp = request.headers.get("X-HubSpot-Request-Timestamp");

  if (!signature || !timestamp || !verifySignature("POST", request.url, body, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: HubSpotWebhookEvent[];
  try {
    events = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // HubSpot normally sends a handful of events per call (batched, not
  // necessarily one), so processing inline (rather than needing a
  // background-task primitive this deployment target doesn't reliably
  // have) stays well within HubSpot's response-time expectations.
  for (const event of events) {
    const [objectName, action] = event.subscriptionType.split(".");
    try {
      if (event.subscriptionType === "contact.creation") {
        const outcome = await syncHubSpotContactFromWebhook(String(event.objectId));
        if (outcome.status === "created") {
          console.log(`HubSpot webhook: created lead "${outcome.leadName}" from contact ${event.objectId}`);
        }
      } else if (action === "creation" || action === "propertyChange") {
        // Engagement types (call/email/meeting/note/task) — new activity
        // or an edit to activity already synced. Unrecognized object
        // names (e.g. a future subscription type) are a no-op, not an
        // error — see ENGAGEMENT_TYPE_BY_WEBHOOK_NAME.
        const outcome = await syncHubSpotEngagementFromWebhook(objectName, String(event.objectId));
        if (outcome.status === "synced") {
          console.log(`HubSpot webhook: synced ${objectName} ${event.objectId} to lead(s) ${outcome.leadIds.join(", ")}`);
        }
      }
    } catch (err) {
      console.error(`HubSpot webhook: failed to process ${event.subscriptionType} ${event.objectId}:`, err);
    }
  }

  return NextResponse.json({ received: events.length });
}
