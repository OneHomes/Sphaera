import { prisma } from "./prisma";

// Shared by the SMS/WhatsApp webhooks (lib/sakariWebhook.ts,
// lib/superchat.ts), which only know the other party's phone number.

export const digitsOf = (s: string) => s.replace(/\D/g, "");

/**
 * Leads whose phone matches, compared on the last 10 digits so "+1 (571)
 * 839-6111", "15718396111" and "+15718396111" all agree. A plain
 * `contains` on the digit tail catches the common case cheaply; formatted
 * numbers (spaces/dashes) fall back to a short-tail scan checked in code.
 */
export async function leadsForPhone(phone: string): Promise<{ id: string; name: string }[]> {
  const tail = digitsOf(phone).slice(-10);
  if (tail.length < 7) return [];
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

/**
 * Insert-or-update one externally sourced timeline row. The external id
 * lives in hubspotEngagementId with a source prefix ("sakari:", "superchat:")
 * — it's the timeline's only external-id slot, and the prefix keeps these
 * from colliding with HubSpot's numeric engagement ids.
 */
export async function upsertExternalTimelineEvent(row: {
  leadId: string;
  type: string;
  summary: string;
  occurredAt: Date;
  externalId: string | null;
}): Promise<"created" | "updated"> {
  const existing = row.externalId
    ? await prisma.leadTimelineEvent.findFirst({
        where: { hubspotEngagementId: row.externalId, leadId: row.leadId },
        select: { id: true },
      })
    : null;
  if (existing) {
    await prisma.leadTimelineEvent.update({
      where: { id: existing.id },
      data: { summary: row.summary, occurredAt: row.occurredAt },
    });
    return "updated";
  }
  await prisma.leadTimelineEvent.create({
    data: {
      leadId: row.leadId,
      type: row.type,
      summary: row.summary,
      occurredAt: row.occurredAt,
      hubspotEngagementId: row.externalId,
    },
  });
  return "created";
}
