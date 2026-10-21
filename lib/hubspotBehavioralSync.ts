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

export type BehavioralSyncResult = { imported: number };

export async function syncBehavioralEventsForLead(
  leadId: string,
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

  if (truthy(email)) {
    try {
      const mailEvents = await fetchMarketingEmailEvents(email);
      const subjectByCampaign = new Map<number, string>();
      for (const e of mailEvents) {
        if (e.subject && e.emailCampaignId !== undefined) subjectByCampaign.set(e.emailCampaignId, e.subject);
      }
      for (const e of mailEvents) {
        if (existingEngagementIds.has(e.id)) continue;
        const subject = (e.emailCampaignId !== undefined && subjectByCampaign.get(e.emailCampaignId)) || e.subject;
        rows.push({
          leadId,
          type: "marketing_email",
          summary: `Marketing email ${e.type}${subject ? `: ${trunc(subject, 300)}` : ""}`,
          occurredAt: new Date(e.created),
          hubspotEngagementId: e.id,
        });
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
  leads: { id: string; hubspotId: string; email: string | null }[],
  existingEngagementIds: Set<string>
): Promise<BehavioralSyncResult> {
  let imported = 0;
  for (const lead of leads) {
    const result = await syncBehavioralEventsForLead(lead.id, lead.hubspotId, lead.email, existingEngagementIds);
    imported += result.imported;
  }
  return { imported };
}
