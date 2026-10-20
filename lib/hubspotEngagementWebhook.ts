import { prisma } from "./prisma";
import { batchReadObjects, batchReadAssociations } from "./hubspot";
import { ENGAGEMENT_TYPE_BY_WEBHOOK_NAME } from "./hubspotActivitySync";
import { createNotification } from "./notifications";
import { getValidGraphAccessToken } from "./graphTokenStore";
import { sendMail } from "./graph";

// Real-time counterpart to lib/hubspotActivitySync.ts's bulk sweep —
// instead of waiting for the next full sync, HubSpot pushes a webhook
// event the instant a call/email/meeting/note/task is created OR edited
// on a contact we already have as a lead (see app/api/webhooks/hubspot/
// route.ts, subscribed to e.g. "call.creation" and "call.propertyChange").
//
// "Edited" is handled as an upsert keyed on hubspotEngagementId, so if an
// engagement's details change in HubSpot after it was first synced (a
// call disposition gets corrected, a note gets edited), the existing
// LeadTimelineEvent row is updated in place rather than duplicated.

export type EngagementWebhookOutcome =
  | { status: "synced"; leadIds: string[] }
  | { status: "unsupported_type" }
  | { status: "not_found" }
  | { status: "no_matching_lead" };

export async function syncHubSpotEngagementFromWebhook(
  webhookObjectName: string, // e.g. "call" from subscriptionType "call.creation"
  engagementId: string
): Promise<EngagementWebhookOutcome> {
  const config = ENGAGEMENT_TYPE_BY_WEBHOOK_NAME[webhookObjectName];
  if (!config) return { status: "unsupported_type" };

  const [engagement] = await batchReadObjects(config.hubspotType, [engagementId], config.properties);
  if (!engagement) return { status: "not_found" };

  const associations = await batchReadAssociations(config.hubspotType, "contacts", [engagementId]);
  const contactIds = associations.get(engagementId) ?? [];
  if (contactIds.length === 0) return { status: "no_matching_lead" };

  const leads = await prisma.lead.findMany({
    where: { hubspotId: { in: contactIds } },
    select: { id: true, name: true, assignedUserId: true },
  });
  if (leads.length === 0) return { status: "no_matching_lead" };

  const occurredAt =
    typeof engagement.properties.hs_timestamp === "string" && engagement.properties.hs_timestamp.trim()
      ? new Date(engagement.properties.hs_timestamp)
      : new Date();
  const summary = config.summarize(engagement.properties);

  // One engagement can be associated with more than one contact/lead
  // (rare, but possible) — upsert per lead so each gets its own row.
  // Not a DB-level upsert: hubspotEngagementId is nullable + indexed
  // rather than unique (same SQL Server multi-NULL reason as hubspotId/
  // salesforceId elsewhere — a (hubspotEngagementId, leadId) unique
  // constraint would wrongly collide across a lead's own native/NULL
  // timeline rows), so existence is checked in app code instead.
  for (const lead of leads) {
    const existing = await prisma.leadTimelineEvent.findFirst({
      where: { hubspotEngagementId: engagementId, leadId: lead.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.leadTimelineEvent.update({ where: { id: existing.id }, data: { summary, occurredAt } });
    } else {
      await prisma.leadTimelineEvent.create({
        data: { leadId: lead.id, type: config.timelineType, summary, occurredAt, hubspotEngagementId: engagementId },
      });
    }

    // Real-time only (not the bulk sweep) — the assigned user should
    // hear about new/changed activity on their own lead as it happens,
    // not get flooded during a historical import. Both best-effort: a
    // notification/email failure must never break the sync itself.
    if (lead.assignedUserId) {
      await notifyAssignedUserOfActivity(lead.assignedUserId, lead.id, lead.name, config.timelineType, summary);
    }
  }

  return { status: "synced", leadIds: leads.map((l) => l.id) };
}

async function notifyAssignedUserOfActivity(
  userId: string,
  leadId: string,
  leadName: string,
  activityType: string,
  summary: string
): Promise<void> {
  await createNotification(
    userId,
    "lead_activity_updated",
    "New activity on your lead",
    `${leadName} — new ${activityType}`,
    `/leads/${leadId}`
  );

  try {
    const [{ accessToken }, user] = await Promise.all([
      getValidGraphAccessToken(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    if (!accessToken || !user) return;

    await sendMail(
      accessToken,
      user.email,
      `New activity on ${leadName}`,
      `<p>There's new activity on <strong>${leadName}</strong>.</p><p>${summary
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/\n/g, "<br>")}</p><p><a href="https://apex.sphaera.tech/leads/${leadId}">View lead</a></p>`
    );
  } catch (err) {
    console.error(`Failed to email-notify user ${userId} of activity on lead ${leadId}:`, err);
  }
}
