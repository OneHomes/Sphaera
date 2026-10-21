import { prisma } from "./prisma";
import { fetchContactBehavioralEvents, fetchMarketingEmailEvents } from "./hubspot";

// Page views, form submissions, and marketing email history — confirmed
// 2026-10-21 these ARE retrievable via HubSpot's API (unlike most of its
// activity-timeline categories, see lib/hubspotActivitySync.ts's own
// comment), but via two completely different, per-contact-only APIs with
// no batch/association mode, unlike every other engagement type this app
// syncs. That means this is one HTTP call per event type per lead (3
// total) — fine for the curated handful of leads this was built for, but
// NOT something to run across the full ~191,000-lead base without first
// adding real batching/throttling, the same lesson as every other full
// sweep this session.

function truthy(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const STATUS_LABELS: Record<string, string> = {
  SENT: "Sent",
  PROCESSED: "Processed",
  DELIVERED: "Delivered",
  OPEN: "Opened",
  CLICK: "Clicked",
  BOUNCE: "Bounced",
  DROPPED: "Dropped",
  DEFERRED: "Deferred",
  SPAMREPORT: "Marked as spam",
  SUPPRESSED: "Suppressed",
  UNSUBSCRIBE: "Unsubscribed",
  STATUSCHANGE: "Status changed",
  REPLY: "Replied",
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type BehavioralSyncResult = { imported: number };

export async function syncBehavioralEventsForLead(
  leadId: string,
  leadName: string,
  hubspotContactId: string,
  email: string | null,
  existingEngagementIds: Set<string>
): Promise<BehavioralSyncResult> {
  let imported = 0;
  const rows: { leadId: string; type: string; summary: string; occurredAt: Date; hubspotEngagementId: string }[] = [];

  try {
    const pageViews = await fetchContactBehavioralEvents(hubspotContactId, "e_visited_page");
    for (const e of pageViews) {
      if (existingEngagementIds.has(e.id)) continue;
      const title = e.properties.hs_page_title || e.properties.hs_url || "(unknown page)";
      rows.push({
        leadId,
        type: "page_view",
        summary: `Page view: ${trunc(title, 500)}`,
        occurredAt: new Date(e.occurredAt),
        hubspotEngagementId: e.id,
      });
    }
  } catch (err) {
    console.error(`Behavioral sync: page views failed for lead ${leadId}:`, err);
  }

  try {
    const formSubmissions = await fetchContactBehavioralEvents(hubspotContactId, "e_submitted_form");
    for (const e of formSubmissions) {
      if (existingEngagementIds.has(e.id)) continue;
      // No human-readable form name comes back on the event itself
      // (would need a separate Forms API lookup by hs_form_id) — the
      // page URL it was submitted from, minus its (often huge, UTM-
      // laden) query string, is a reasonable stand-in.
      const url = e.properties.hs_url ? e.properties.hs_url.split("?")[0] : null;
      let visitorType: string | null = null;
      if (truthy(e.properties.hs_form_submission_data)) {
        try {
          visitorType = JSON.parse(e.properties.hs_form_submission_data).visitorType ?? null;
        } catch {
          // malformed/unexpected shape — fine to just omit visitor type
        }
      }
      const title = url ? `${url}${visitorType ? ` (${visitorType})` : ""}` : "(form)";
      rows.push({
        leadId,
        type: "form_submission",
        summary: `Form submission: ${trunc(title, 500)}`,
        occurredAt: new Date(e.occurredAt),
        hubspotEngagementId: e.id,
      });
    }
  } catch (err) {
    console.error(`Behavioral sync: form submissions failed for lead ${leadId}:`, err);
  }

  // HubSpot shows marketing email activity as ONE card per send — subject,
  // an Opens/Clicks/Replies summary line, then the individual statuses
  // (Sent/Delivered/Opened/Clicked) — not a separate timeline entry per
  // status. Matched here by grouping all events sharing an
  // emailCampaignId into a single row, keyed by a synthetic
  // "campaign-{id}" id (not a real HubSpot engagement id) so a later
  // sync updates that one row in place — e.g. a fresh Open coming in
  // tomorrow updates today's card instead of creating a new one.
  if (truthy(email)) {
    try {
      const mailEvents = await fetchMarketingEmailEvents(email);
      const byCampaign = new Map<number, typeof mailEvents>();
      for (const e of mailEvents) {
        const campaignId = e.emailCampaignId ?? -1;
        const list = byCampaign.get(campaignId) ?? [];
        list.push(e);
        byCampaign.set(campaignId, list);
      }

      for (const [campaignId, campaignEvents] of byCampaign) {
        const subject = campaignEvents.find((e) => truthy(e.subject))?.subject ?? "(no subject)";
        const opens = campaignEvents.filter((e) => e.type === "OPEN").length;
        const clicks = campaignEvents.filter((e) => e.type === "CLICK").length;
        const replies = campaignEvents.filter((e) => e.type === "REPLY").length;
        const sentEvent = campaignEvents.find((e) => e.type === "SENT");

        const statusLines = [...campaignEvents]
          .sort((a, b) => b.created - a.created)
          .map((e) => `${STATUS_LABELS[e.type] ?? e.type}: ${formatTimestamp(e.created)}`)
          .join("\n");

        const summary = [
          `Marketing email sent to ${leadName} <${email}>`,
          "",
          subject,
          "",
          `Opens: ${opens}  Clicks: ${clicks}  Replies: ${replies}`,
          "",
          statusLines,
        ].join("\n");

        const occurredAt = sentEvent ? new Date(sentEvent.created) : new Date(Math.min(...campaignEvents.map((e) => e.created)));
        const groupKey = `campaign-${campaignId}`;

        const existing = await prisma.leadTimelineEvent.findFirst({
          where: { leadId, hubspotEngagementId: groupKey },
          select: { id: true, summary: true },
        });
        if (existing) {
          if (existing.summary !== summary) {
            await prisma.leadTimelineEvent.update({ where: { id: existing.id }, data: { summary, occurredAt } });
            imported++;
          }
        } else {
          rows.push({ leadId, type: "marketing_email", summary, occurredAt, hubspotEngagementId: groupKey });
        }
      }
    } catch (err) {
      console.error(`Behavioral sync: marketing emails failed for lead ${leadId}:`, err);
    }
  }

  if (rows.length > 0) {
    await prisma.leadTimelineEvent.createMany({ data: rows });
    for (const r of rows) existingEngagementIds.add(r.hubspotEngagementId);
    imported = rows.length;
  }

  return { imported };
}

export async function syncBehavioralEventsForLeads(
  leads: { id: string; name: string; hubspotId: string; email: string | null }[],
  existingEngagementIds: Set<string>
): Promise<BehavioralSyncResult> {
  let imported = 0;
  for (const lead of leads) {
    const result = await syncBehavioralEventsForLead(lead.id, lead.name, lead.hubspotId, lead.email, existingEngagementIds);
    imported += result.imported;
  }
  return { imported };
}
