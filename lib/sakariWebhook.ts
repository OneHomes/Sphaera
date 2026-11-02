import { prisma } from "./prisma";
import { logAudit } from "./auditLog";

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
};

export type SakariWebhookOutcome =
  | { status: "synced"; leadIds: string[] }
  | { status: "ignored"; reason: string }
  | { status: "no_matching_lead"; phone: string };

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function findMessage(body: Record<string, unknown>): SakariMessage | null {
  const data = asObject(body.data);
  const candidates = [asObject(data?.message), data, asObject(body.message), body];
  for (const c of candidates) {
    if (c && (typeof c.message === "string" || asObject(c.contact))) return c as SakariMessage;
  }
  return null;
}

function contactPhone(m: SakariMessage): string | null {
  const mobile = m.contact?.mobile;
  const raw = typeof mobile === "string" ? mobile : mobile?.number;
  return raw && raw.replace(/\D/g, "").length >= 7 ? raw : null;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

/**
 * Leads whose phone matches, compared on the last 10 digits so "+1 (571)
 * 839-6111", "15718396111" and "+15718396111" all agree. A plain
 * `contains` on the digit tail catches the common case cheaply; formatted
 * numbers (spaces/dashes) fall back to a short-tail scan checked in code.
 */
async function leadsForPhone(phone: string): Promise<{ id: string; name: string }[]> {
  const tail = digitsOf(phone).slice(-10);
  const direct = await prisma.lead.findMany({
    where: { contact: { contains: tail } },
    select: { id: true, name: true },
    take: 5,
  });
  if (direct.length > 0) return direct;

  const loose = await prisma.lead.findMany({
    where: { contact: { contains: tail.slice(-4) } },
    select: { id: true, name: true, contact: true },
    take: 200,
  });
  return loose.filter((l) => digitsOf(l.contact).endsWith(tail)).map(({ id, name }) => ({ id, name }));
}

export async function syncSakariWebhook(body: unknown): Promise<SakariWebhookOutcome> {
  const envelope = asObject(body);
  if (!envelope) return { status: "ignored", reason: "body is not a JSON object" };

  const eventType = String(envelope.eventType ?? envelope.type ?? envelope.event ?? "");
  if (eventType && !/message-(sent|received)/.test(eventType)) {
    return { status: "ignored", reason: `event type ${eventType}` };
  }

  const message = findMessage(envelope);
  const phone = message ? contactPhone(message) : null;
  if (!message || !phone) {
    await logAudit({
      actorId: "system",
      actorEmail: "sakari-webhook",
      action: "sakari_webhook_unrecognised",
      details: `Unrecognised Sakari payload (${eventType || "no event type"}); fields: ${Object.keys(envelope).join(", ")}${
        asObject(envelope.data) ? `; data fields: ${Object.keys(asObject(envelope.data)!).join(", ")}` : ""
      }`,
    });
    return { status: "ignored", reason: "no message/phone in payload" };
  }

  const leads = await leadsForPhone(phone);
  if (leads.length === 0) return { status: "no_matching_lead", phone };

  const outgoing = message.outgoing ?? eventType !== "message-received";
  const contactName = [message.contact?.firstName, message.contact?.lastName].filter(Boolean).join(" ");
  const occurredAt = message.created?.at && !Number.isNaN(Date.parse(message.created.at)) ? new Date(message.created.at) : new Date();
  // Stored in hubspotEngagementId with a "sakari:" prefix — the column is
  // the timeline's only external-id slot, and the prefix keeps Sakari ids
  // from ever colliding with HubSpot's numeric engagement ids.
  const externalId = message.id ? `sakari:${message.id}` : null;

  for (const lead of leads) {
    const who = `${contactName || lead.name} (${phone})`;
    const summary = `SMS ${outgoing ? "sent to" : "received from"} ${who} via Sakari${message.message ? `\n${message.message}` : ""}`;
    const existing = externalId
      ? await prisma.leadTimelineEvent.findFirst({ where: { hubspotEngagementId: externalId, leadId: lead.id }, select: { id: true } })
      : null;
    if (existing) {
      await prisma.leadTimelineEvent.update({ where: { id: existing.id }, data: { summary, occurredAt } });
    } else {
      await prisma.leadTimelineEvent.create({
        data: { leadId: lead.id, type: "sms", summary, occurredAt, hubspotEngagementId: externalId },
      });
    }
  }

  return { status: "synced", leadIds: leads.map((l) => l.id) };
}
