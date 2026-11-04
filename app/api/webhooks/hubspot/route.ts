import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncHubSpotContactFromWebhook } from "@/lib/hubspotWebhook";
import { removeHubSpotEngagementFromWebhook, syncHubSpotEngagementFromWebhook } from "@/lib/hubspotEngagementWebhook";

// Real-time HubSpot -> Sphaera sync. HubSpot calls this the instant a
// contact is created, OR a call/email/meeting/note/task/communication
// (WhatsApp, LinkedIn message, SMS) is created or edited on a contact
// that's already a lead here — subscribe to "Contact creation" plus, for
// each engagement type including "Communication", both "creation" and
// "propertyChange" (and optionally "deletion") on this Private App's Webhooks tab, target URL
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

// HubSpot signs the URL it called (https://apex.sphaera.tech/...). Behind
// Azure Static Web Apps, request.url can carry the internal host instead,
// which would fail every signature — so the public URL is rebuilt from the
// forwarded host headers and both are accepted.
function candidateUrls(request: Request): string[] {
  const urls = new Set<string>([request.url]);
  const parsed = new URL(request.url);
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) urls.add(`https://${host.split(",")[0].trim()}${pathAndQuery}`);
  if (process.env.NEXTAUTH_URL) urls.add(`${new URL(process.env.NEXTAUTH_URL).origin}${pathAndQuery}`);
  return [...urls];
}

function verifySignature(method: string, urls: string[], body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (!secret) return false;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_REQUEST_AGE_MS) return false;

  const actualBuf = Buffer.from(signature);
  return urls.some((url) => {
    const expected = createHmac("sha256", secret).update(`${method}${url}${body}${timestamp}`).digest("base64");
    const expectedBuf = Buffer.from(expected);
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  });
}

// Generic ("object.creation" / "object.propertyChange") subscriptions —
// what HubSpot's current private-app Webhooks screen creates — name the
// object only through objectTypeId. Mapped back to the legacy names
// ("call", "note", …) the rest of the sync is keyed on.
const OBJECT_NAME_BY_TYPE_ID: Record<string, string> = {
  "0-1": "contact",
  "0-18": "communication",
  "0-27": "task",
  "0-46": "note",
  "0-47": "meeting",
  "0-48": "call",
  "0-49": "email",
};

type HubSpotWebhookEvent = {
  eventId: number;
  subscriptionType: string; // "contact.creation" (legacy) or "object.creation" (generic)
  objectTypeId?: string; // generic subscriptions only, e.g. "0-48" for calls
  objectId: number;
  occurredAt: number;
};

/** Lets an Admin confirm the endpoint is deployed and its secret is set (never reveals the secret). */
export async function GET() {
  return NextResponse.json({ ok: true, secretConfigured: Boolean(process.env.HUBSPOT_WEBHOOK_SECRET) });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("X-HubSpot-Signature-v3");
  const timestamp = request.headers.get("X-HubSpot-Request-Timestamp");

  if (!signature || !timestamp || !verifySignature("POST", candidateUrls(request), body, timestamp, signature)) {
    console.warn(
      `HubSpot webhook rejected: ${!process.env.HUBSPOT_WEBHOOK_SECRET ? "HUBSPOT_WEBHOOK_SECRET not set" : !signature || !timestamp ? "missing signature headers" : "signature mismatch or stale timestamp"}`
    );
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
    const [rawObjectName, action] = event.subscriptionType.split(".");
    const objectName =
      rawObjectName === "object" ? OBJECT_NAME_BY_TYPE_ID[event.objectTypeId ?? ""] : rawObjectName;
    if (!objectName) {
      console.warn(`HubSpot webhook: ignored ${event.subscriptionType} for unsupported object type ${event.objectTypeId}`);
      continue;
    }
    try {
      if (objectName === "contact" && (action === "creation" || action === "propertyChange")) {
        // propertyChange matters here too, not just creation: a contact
        // missing name/email/phone at creation time is excluded (see
        // lib/hubspotContactFilter.ts) and stays that way until someone
        // fills in the missing field — e.g. an agent adds a phone number
        // weeks later. syncHubSpotContactFromWebhook already no-ops if
        // the lead exists or the contact still doesn't qualify, so
        // calling it on every edit is safe, not just on creation.
        // For a contact that's already a lead, an edit refreshes its details.
        const outcome = await syncHubSpotContactFromWebhook(String(event.objectId));
        if (outcome.status === "created") {
          console.log(`HubSpot webhook: created lead "${outcome.leadName}" from contact ${event.objectId}`);
        } else if (outcome.status === "updated") {
          console.log(`HubSpot webhook: updated lead ${outcome.leadId} from contact ${event.objectId}`);
        }
      } else if (objectName !== "contact" && action === "deletion") {
        const removed = await removeHubSpotEngagementFromWebhook(objectName, String(event.objectId));
        console.log(`HubSpot webhook: ${objectName} ${event.objectId} deleted in HubSpot, removed ${removed} timeline row(s)`);
      } else if (action === "creation" || action === "propertyChange") {
        // Engagement types (call/email/meeting/note/task) — new activity
        // or an edit to activity already synced. Unrecognized object
        // names (e.g. a future subscription type) are a no-op, not an
        // error — see ENGAGEMENT_TYPE_BY_WEBHOOK_NAME.
        const outcome = await syncHubSpotEngagementFromWebhook(objectName, String(event.objectId));
        if (outcome.status === "synced") {
          console.log(`HubSpot webhook: synced ${objectName} ${event.objectId} to lead(s) ${outcome.leadIds.join(", ")}`);
        } else {
          console.log(`HubSpot webhook: ${objectName} ${event.objectId} not synced (${outcome.status})`);
        }
      }
    } catch (err) {
      console.error(`HubSpot webhook: failed to process ${event.subscriptionType} ${event.objectId}:`, err);
    }
  }

  return NextResponse.json({ received: events.length });
}
