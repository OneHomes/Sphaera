import { prisma } from "./prisma";
import { logAudit } from "./auditLog";
import { digitsOf, leadsForPhone, upsertExternalTimelineEvent } from "./leadPhoneMatch";

// Superchat (WhatsApp) -> lead timeline. Like Sakari, Superchat's HubSpot
// integration only draws onto HubSpot's own timeline — checked 2026-11-02:
// recent Superchat conversations' HubSpot contacts had 0 communication
// records — so WhatsApp comes from Superchat's own API instead:
//   - real time: a webhook on message_inbound / message_outbound
//     (app/api/webhooks/superchat/route.ts)
//   - history: syncSuperchatHistoryForLeads, run from
//     scripts/sync-superchat-history.ts
//
// Superchat doesn't document its webhook payload or signature, so the
// webhook only takes the message id from the notification and re-reads
// the message from the API with our key. A forged notification can't
// plant anything: the id has to exist in our own Superchat workspace.

const BASE = "https://api.superchat.com/v1.0";

type ScMessage = {
  id: string;
  direction?: "inbound" | "outbound";
  status?: string;
  conversation_id: string;
  created_at: string;
  content?: { type?: string; body?: string; caption?: string; subject?: string; text?: string };
  from?: { identifier?: string; name?: string };
};
type ScConversation = { id: string; channel?: { type?: string }; contacts?: { id: string }[] };
type ScContact = { id: string; first_name?: string | null; last_name?: string | null; handles?: { type: string; value: string }[] };
type ScPage<T> = { results: T[]; pagination?: { next_cursor?: string | null } };

async function sc<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.SUPERCHAT_API_KEY;
  if (!key) throw new Error("SUPERCHAT_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-KEY": key, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Superchat ${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

function messageText(m: ScMessage): string {
  const c = m.content ?? {};
  switch (c.type) {
    case "text":
    case "whats_app_quick_reply":
    case "whats_app_list":
    case "instagram_story_reply":
    case "instagram_comment":
      return c.body ?? "";
    case "media":
      return c.caption ? `[Attachment] ${c.caption}` : "[Attachment]";
    case "email":
      return [c.subject, c.text].filter(Boolean).join("\n");
    case "whats_app_template":
    case "generic_template":
      return "[WhatsApp template message]";
    default:
      return c.body ?? "";
  }
}

function contactName(c: ScContact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function contactPhone(c: ScContact): string | null {
  const phone = c.handles?.find((h) => h.type === "phone")?.value;
  return phone && digitsOf(phone).length >= 7 ? phone : null;
}

function timelineRow(m: ScMessage, conv: ScConversation, contact: ScContact, phone: string, leadName: string) {
  const inbound = m.direction === "inbound";
  const channel = conv.channel?.type ?? "";
  const label = channel === "whats_app" ? "WhatsApp" : channel ? channel.replace(/_/g, " ") : "Message";
  const who = `${contactName(contact) || leadName} (${phone})`;
  const agent = !inbound && m.from?.name ? ` by ${m.from.name}` : "";
  const text = messageText(m);
  return {
    type: channel === "whats_app" ? "whatsapp" : "communication",
    summary: `${label} ${inbound ? "received from" : "sent to"} ${who}${agent} via Superchat${text ? `\n${text}` : ""}`,
    occurredAt: Number.isNaN(Date.parse(m.created_at)) ? new Date() : new Date(m.created_at),
    externalId: `superchat:${m.id}`,
  };
}

async function conversationParty(conversationId: string): Promise<{ conv: ScConversation; contact: ScContact; phone: string } | null> {
  const conv = await sc<ScConversation>(`/conversations/${conversationId}`);
  const contactId = conv.contacts?.[0]?.id;
  if (!contactId) return null;
  const contact = await sc<ScContact>(`/contacts/${contactId}`);
  const phone = contactPhone(contact);
  return phone ? { conv, contact, phone } : null;
}

// ---------------------------------------------------------------- webhook

export type SuperchatWebhookOutcome =
  | { status: "synced"; leadIds: string[] }
  | { status: "ignored"; reason: string }
  | { status: "no_matching_lead" };

/** Superchat message ids look like "ms_…"; found wherever the notification puts them. */
function findMessageId(v: unknown, depth = 0): string | null {
  if (depth > 4 || v === null || v === undefined) return null;
  if (typeof v === "string") return /^ms_[A-Za-z0-9]+$/.test(v) ? v : null;
  if (typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  for (const key of ["message_id", "id"]) {
    const hit = findMessageId(obj[key], depth + 1);
    if (hit) return hit;
  }
  for (const value of Object.values(obj)) {
    const hit = findMessageId(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export async function syncSuperchatWebhook(body: unknown): Promise<SuperchatWebhookOutcome> {
  const envelope = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const eventType = String(envelope.event ?? envelope.type ?? envelope.event_type ?? "");
  if (eventType && !/message_(inbound|outbound)/.test(eventType)) {
    return { status: "ignored", reason: `event type ${eventType}` };
  }

  const messageId = findMessageId(body);
  if (!messageId) {
    await logAudit({
      actorId: "system",
      actorEmail: "superchat-webhook",
      action: "superchat_webhook_unrecognised",
      details: `Unrecognised Superchat payload (${eventType || "no event type"}); fields: ${Object.keys(envelope).join(", ")}`,
    });
    return { status: "ignored", reason: "no message id in payload" };
  }

  const message = await sc<ScMessage>(`/messages/${messageId}`);
  const party = await conversationParty(message.conversation_id);
  if (!party) return { status: "ignored", reason: "conversation has no contact phone" };

  const leads = await leadsForPhone(party.phone);
  if (leads.length === 0) return { status: "no_matching_lead" };

  for (const lead of leads) {
    await upsertExternalTimelineEvent({ leadId: lead.id, ...timelineRow(message, party.conv, party.contact, party.phone, lead.name) });
  }
  return { status: "synced", leadIds: leads.map((l) => l.id) };
}

// ---------------------------------------------------------------- history

export type SuperchatHistoryResult = {
  leadsChecked: number;
  leadsWithSuperchat: number;
  messagesImported: number;
  leadsFailed: number;
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function e164(contact: string): string | null {
  const d = digitsOf(contact);
  return d.length >= 7 ? `+${d}` : null;
}

/** Every Superchat message for each lead's phone, de-duplicated against what's already on the timeline. */
export async function syncSuperchatHistoryForLeads(
  onProgress?: (r: SuperchatHistoryResult) => void
): Promise<SuperchatHistoryResult> {
  const leads = await prisma.lead.findMany({ select: { id: true, name: true, contact: true } });
  const existing = new Set(
    (
      await prisma.leadTimelineEvent.findMany({
        where: { hubspotEngagementId: { startsWith: "superchat:" } },
        select: { hubspotEngagementId: true, leadId: true },
      })
    ).map((r) => `${r.leadId}|${r.hubspotEngagementId}`)
  );

  const result: SuperchatHistoryResult = { leadsChecked: 0, leadsWithSuperchat: 0, messagesImported: 0, leadsFailed: 0 };

  for (const lead of leads) {
    result.leadsChecked++;
    const phone = e164(lead.contact);
    if (!phone) continue;
    try {
      const found = await sc<ScPage<ScContact>>(`/contacts/search`, {
        method: "POST",
        body: JSON.stringify({ query: { value: [{ field: "phone", operator: "=", value: phone }] } }),
      });
      if (found.results.length > 0) result.leadsWithSuperchat++;

      for (const contact of found.results) {
        const convs = await sc<ScPage<ScConversation>>(`/contacts/${contact.id}/conversations`);
        for (const conv of convs.results) {
          let cursor: string | null | undefined;
          do {
            const page = await sc<ScPage<ScMessage>>(
              `/conversations/${conv.id}/messages?limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`
            );
            const rows = page.results
              .map((m) => ({ leadId: lead.id, ...timelineRow(m, conv, contact, phone, lead.name) }))
              .filter((r) => !existing.has(`${r.leadId}|${r.externalId}`));
            if (rows.length > 0) {
              await prisma.leadTimelineEvent.createMany({
                data: rows.map((r) => ({
                  leadId: r.leadId,
                  type: r.type,
                  summary: r.summary,
                  occurredAt: r.occurredAt,
                  hubspotEngagementId: r.externalId,
                })),
              });
              for (const r of rows) existing.add(`${r.leadId}|${r.externalId}`);
              result.messagesImported += rows.length;
            }
            cursor = page.pagination?.next_cursor;
            await pause(200);
          } while (cursor);
        }
      }
    } catch (err) {
      result.leadsFailed++;
      console.error(`Superchat history: lead ${lead.id} failed:`, err);
    }
    onProgress?.(result);
  }
  return result;
}

// ---------------------------------------------------------------- setup

export type SuperchatWebhookSubscription = { id: string; target_url: string; events?: { type: string }[] };

export async function listSuperchatWebhooks(): Promise<SuperchatWebhookSubscription[]> {
  return (await sc<ScPage<SuperchatWebhookSubscription>>(`/webhooks`)).results;
}

export async function createSuperchatWebhook(targetUrl: string): Promise<SuperchatWebhookSubscription> {
  return sc<SuperchatWebhookSubscription>(`/webhooks`, {
    method: "POST",
    body: JSON.stringify({ target_url: targetUrl, events: [{ type: "message_inbound" }, { type: "message_outbound" }] }),
  });
}
