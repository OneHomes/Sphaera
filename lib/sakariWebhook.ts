import { logAudit } from "./auditLog";
import { leadsForPhone, upsertExternalTimelineEvent } from "./leadPhoneMatch";

// Sakari SMS -> lead timeline. Sakari's HubSpot integration only draws its
// SMS onto HubSpot's own timeline (an app timeline event, not a CRM
// "communication" record), and HubSpot's API gives no way to read another
// app's timeline events — confirmed 2026-11-02 against a contact with a
// visible Sakari SMS: 0 communications associated. So SMS comes straight
// from Sakari instead, via a webhook subscribed to "message-sent" and
// "message-received" (see app/api/webhooks/sakari/route.ts).
//
// Sakari doesn't document its notification payload, only the Message
// object (id, message, outgoing, contact.mobile.number, created.at). The
// message is looked for in the usual envelope spots rather than one fixed
// shape; anything unrecognised is recorded in the audit log (field names
// only) so the real shape can be checked without guessing.

type SakariMessage = {
  id?: string;
  message?: string;
  outgoing?: boolean;
  status?: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    mobile?: { number?: string; country?: string } | string;
  };
  created?: { at?: string };
  updated?: { at?: string };
};

export type SakariWebhookOutcome =
  | { status: "synced"; leadIds: string[] }
  | { status: "ignored"; reason: string }
  | { status: "no_matching_lead"; phone: string };

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function findMessage(body: Record<string, unknown>): SakariMessage | null {
  // Live deliveries (seen 2026-11-02) are { accountId, eventType, payload }.
  const payload = asObject(body.payload);
  const data = asObject(body.data);
  const candidates = [
    asObject(payload?.message),
    asObject(payload?.data),
    payload,
    asObject(data?.message),
    data,
    asObject(body.message),
    body,
  ];
  for (const c of candidates) {
    if (c && (typeof c.message === "string" || asObject(c.contact))) return c as SakariMessage;
  }
  return null;
}

/**
 * The contact's number — Sakari's Message has it as contact.mobile.number,
 * but it's searched for as any "mobile" field in the envelope so a contact
 * placed beside the message (or under conversation.contact) still matches.
 * Never "phoneNumber": that's Sakari's own sending number.
 */
function findMobile(v: unknown, depth = 0): string | null {
  const obj = asObject(v);
  if (!obj || depth > 5) return null;
  const mobile = obj.mobile;
  const raw = typeof mobile === "string" ? mobile : (asObject(mobile)?.number as string | undefined);
  if (typeof raw === "string" && raw.replace(/\D/g, "").length >= 7) return raw;
  for (const value of Object.values(obj)) {
    const hit = findMobile(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function contactPhone(m: SakariMessage, envelope: Record<string, unknown>): string | null {
  return findMobile(m) ?? findMobile(envelope);
}

export async function syncSakariWebhook(body: unknown): Promise<SakariWebhookOutcome> {
  const envelope = asObject(body);
  if (!envelope) return { status: "ignored", reason: "body is not a JSON object" };

  const eventType = String(envelope.eventType ?? envelope.type ?? envelope.event ?? "");
  if (eventType && !/message-(sent|received)/.test(eventType)) {
    return { status: "ignored", reason: `event type ${eventType}` };
  }

  const message = findMessage(envelope);
  const phone = message ? contactPhone(message, envelope) : null;
  if (!message || !phone) {
    await logAudit({
      actorId: "system",
      actorEmail: "sakari-webhook",
      action: "sakari_webhook_unrecognised",
      details: `Unrecognised Sakari payload (${eventType || "no event type"}); fields: ${Object.keys(envelope).join(", ")}${["payload", "data"]
        .map((k) => asObject(envelope[k]))
        .map((o, i) => (o ? `; ${i === 0 ? "payload" : "data"} fields: ${Object.keys(o).join(", ")}` : ""))
        .join("")}${message ? `; message fields: ${Object.keys(message).join(", ")}` : ""}`,
    });
    return { status: "ignored", reason: "no message/phone in payload" };
  }

  const leads = await leadsForPhone(phone);
  if (leads.length === 0) return { status: "no_matching_lead", phone };

  for (const lead of leads) {
    await upsertExternalTimelineEvent({
      leadId: lead.id,
      ...sakariTimelineRow(message, phone, lead.name, eventType !== "message-received"),
    });
  }

  return { status: "synced", leadIds: leads.map((l) => l.id) };
}

/**
 * One timeline row for a Sakari message — shared by the webhook and the
 * history import (lib/sakariHistory.ts) so both read identically.
 * occurredAt is Sakari's own time for the SMS, never the time we received
 * it, so SMS sit in true chronological order among the HubSpot
 * emails/calls on the same timeline. For outgoing SMS that's updated.at:
 * campaign messages are created when queued and go out (and appear on
 * HubSpot's timeline) up to an hour later — checked 2026-11-03, a
 * created 20:03Z / updated 21:05Z message shows on HubSpot at 21:06Z.
 * Incoming SMS use created.at (updated.at moves when it's read).
 */
export function sakariTimelineRow(message: SakariMessage, phone: string, leadName: string, outgoingDefault = true) {
  const outgoing = message.outgoing ?? outgoingDefault;
  const contactName = [message.contact?.firstName, message.contact?.lastName].filter(Boolean).join(" ");
  const valid = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? s : undefined);
  const when = (outgoing ? valid(message.updated?.at) : undefined) ?? valid(message.created?.at);
  return {
    type: "sms",
    summary: `SMS ${outgoing ? "sent to" : "received from"} ${contactName || leadName} (${phone}) via Sakari${message.message ? `\n${message.message}` : ""}`,
    occurredAt: when ? new Date(when) : new Date(),
    externalId: message.id ? `sakari:${message.id}` : null,
  };
}

export { findMobile as sakariMessagePhone };
export type { SakariMessage };
