import { prisma } from "./prisma";
import { getLeadScopeWhere, getOpportunityScopeWhere } from "./authz";
import type { AuthUser } from "./authz";

// PRD 5.2 — the 18 named Pilot Success Metrics. Computed for real from
// whatever real data exists today; metrics with no real data source yet
// are returned as `tracked: false` with a one-line reason, rather than a
// fabricated number, consistent with this build's data discipline
// throughout. Revisit each `tracked: false` entry as its blocking gap
// closes (telephony, an attendance field, usage-analytics retention, a
// satisfaction survey mechanism).

export type PilotMetric = {
  key: string;
  label: string;
  tracked: boolean;
  value?: string;
  note: string;
};

const SLA_MINUTES = 60; // matches the Speed to Lead PI dimension's top band

export async function getPilotMetrics(authUser: AuthUser): Promise<PilotMetric[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);

  const leadWhere = getLeadScopeWhere(authUser);
  const oppWhere = getOpportunityScopeWhere(authUser);

  const [leads, opportunities, feedback, pointEvents, allUsersInScope, resolvedChallenges] =
    await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        include: { timelineEvents: { orderBy: { occurredAt: "asc" } } },
      }),
      prisma.opportunity.findMany({ where: oppWhere }),
      prisma.janusFeedback.findMany(),
      prisma.aexPointEvent.findMany({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.findMany({
        where:
          authUser.role === "ADMIN"
            ? {}
            : authUser.role === "MANAGER" && authUser.teamId
              ? { teamId: authUser.teamId }
              : { id: authUser.id },
      }),
      prisma.challenge.findMany({ where: { status: { in: ["ChallengerWon", "OpponentWon", "Draw"] } } }),
    ]);

  const userIds = allUsersInScope.map((u) => u.id);

  // ---- 1 & 2: Speed to first contact ----
  const contactSpeedsMinutes: number[] = [];
  let contactedWithinSla = 0;
  for (const lead of leads) {
    const firstContact = lead.timelineEvents.find((e) => e.type === "call");
    if (firstContact) {
      const minutes = (firstContact.occurredAt.getTime() - lead.createdAt.getTime()) / 60_000;
      contactSpeedsMinutes.push(Math.max(minutes, 0));
      if (minutes <= SLA_MINUTES) contactedWithinSla += 1;
    }
  }
  contactSpeedsMinutes.sort((a, b) => a - b);
  const median =
    contactSpeedsMinutes.length > 0
      ? contactSpeedsMinutes[Math.floor(contactSpeedsMinutes.length / 2)]
      : null;

  // ---- 3: Connected calls per active sales user ----
  const callEvents = leads.flatMap((l) => l.timelineEvents.filter((e) => e.type === "call"));
  const activeSalesUsers = userIds.length || 1;

  // ---- 4/5: Meetings booked (and, as a proxy, "conducted") ----
  const meetingEvents = leads.flatMap((l) => l.timelineEvents.filter((e) => e.type === "meeting"));
  const leadsWithMeeting = leads.filter((l) => l.timelineEvents.some((e) => e.type === "meeting"));

  // ---- 8: Meeting to opportunity conversion ----
  const leadIdsWithOpp = new Set(opportunities.map((o) => o.leadId).filter(Boolean));
  const leadsWithMeetingAndOpp = leadsWithMeeting.filter((l) => leadIdsWithOpp.has(l.id));

  // ---- 9: Opportunity to sale conversion ----
  const closedWon = opportunities.filter((o) => o.stage === "Closed Won");

  // ---- 11: Pipeline value + weighted forecast ----
  const openOpps = opportunities.filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost");
  const pipelineValue = openOpps.reduce((sum, o) => sum + o.value, 0);
  const weightedForecast = openOpps.reduce((sum, o) => sum + (o.value * o.probability) / 100, 0);

  // ---- 12: % leads with complete mandatory data ----
  const completeLeads = leads.filter(
    (l) =>
      l.contact && l.contact !== "—" &&
      l.source && l.source !== "Other" &&
      l.market && l.market !== "Unknown" &&
      l.projectInterest && l.projectInterest !== "Unspecified"
  );

  // ---- 14: Janus recommendation feedback ----
  const usefulFeedback = feedback.filter((f) => f.useful).length;

  // ---- 15/16: Active use, from the sign-in audit trail (just added) ----
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [dauLogs, wauLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "user_signed_in", createdAt: { gte: todayStart }, actorId: { in: userIds } },
      select: { actorId: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "user_signed_in", createdAt: { gte: sevenDaysAgo }, actorId: { in: userIds } },
      select: { actorId: true },
    }),
  ]);
  const dauCount = new Set(dauLogs.map((l) => l.actorId)).size;
  const wauCount = new Set(wauLogs.map((l) => l.actorId)).size;
  const managerAdminIds = allUsersInScope.filter((u) => u.role !== "AGENT").map((u) => u.id);
  const managementWauLogs = wauLogs.filter((l) => managerAdminIds.includes(l.actorId));
  const managementWauCount = new Set(managementWauLogs.map((l) => l.actorId)).size;

  // ---- 18: AEX participation / challenge completion / tier progression ----
  const usersWithPoints = new Set(pointEvents.map((e) => e.userId)).size;

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return [
    {
      key: "speed_to_contact",
      label: "Median speed to first contact",
      tracked: median !== null,
      value: median !== null ? `${median < 60 ? `${Math.round(median)} min` : `${(median / 60).toFixed(1)} hr`}` : undefined,
      note: median !== null ? `Based on ${contactSpeedsMinutes.length} lead(s) with a logged first call` : "No leads with a logged call yet",
    },
    {
      key: "sla_contact_rate",
      label: `% of new leads contacted within ${SLA_MINUTES} min`,
      tracked: contactSpeedsMinutes.length > 0,
      value: contactSpeedsMinutes.length > 0 ? `${Math.round((contactedWithinSla / contactSpeedsMinutes.length) * 100)}%` : undefined,
      note: `${contactedWithinSla}/${contactSpeedsMinutes.length} leads contacted within SLA`,
    },
    {
      key: "connected_calls_per_user",
      label: "Connected calls per active sales user",
      tracked: callEvents.length > 0,
      value: callEvents.length > 0 ? (callEvents.length / activeSalesUsers).toFixed(1) : undefined,
      note: "Manually logged call entries — no telephony integration yet, so this isn't verified connection data",
    },
    {
      key: "meetings_booked",
      label: "Follow ups / meetings booked",
      tracked: true,
      value: String(meetingEvents.length),
      note: "All-time count of logged meeting events in scope",
    },
    {
      key: "meetings_conducted",
      label: "Meetings conducted",
      tracked: false,
      note: "Same as meetings booked today — there's no separate 'conducted' flag on a meeting event yet",
    },
    {
      key: "meeting_attendance_rate",
      label: "Meeting attendance rate",
      tracked: false,
      note: "Not tracked — no attended/no-show field exists on meeting events",
    },
    {
      key: "lead_to_meeting",
      label: "Lead to meeting conversion",
      tracked: leads.length > 0,
      value: leads.length > 0 ? `${Math.round((leadsWithMeeting.length / leads.length) * 100)}%` : undefined,
      note: `${leadsWithMeeting.length}/${leads.length} leads have at least one logged meeting`,
    },
    {
      key: "meeting_to_opportunity",
      label: "Meeting to opportunity conversion",
      tracked: leadsWithMeeting.length > 0,
      value: leadsWithMeeting.length > 0 ? `${Math.round((leadsWithMeetingAndOpp.length / leadsWithMeeting.length) * 100)}%` : undefined,
      note: `${leadsWithMeetingAndOpp.length}/${leadsWithMeeting.length} leads with a meeting also have an opportunity`,
    },
    {
      key: "opportunity_to_sale",
      label: "Opportunity to reservation/sale conversion",
      tracked: opportunities.length > 0,
      value: opportunities.length > 0 ? `${Math.round((closedWon.length / opportunities.length) * 100)}%` : undefined,
      note: `${closedWon.length}/${opportunities.length} opportunities are Closed Won`,
    },
    {
      key: "revenue",
      label: "Revenue attributed to pilot users",
      tracked: true,
      value: fmt(closedWon.reduce((s, o) => s + o.value, 0)),
      note: "Sum of real Closed Won opportunity values in scope",
    },
    {
      key: "pipeline_forecast",
      label: "Pipeline value and weighted forecast accuracy",
      tracked: true,
      value: `${fmt(pipelineValue)} raw / ${fmt(weightedForecast)} weighted`,
      note: "Weighted = value × real per-opportunity probability. \"Accuracy\" itself isn't tracked yet — needs closed outcomes compared against past forecasts over time",
    },
    {
      key: "data_completeness",
      label: "% of leads with complete mandatory data",
      tracked: leads.length > 0,
      value: leads.length > 0 ? `${Math.round((completeLeads.length / leads.length) * 100)}%` : undefined,
      note: `${completeLeads.length}/${leads.length} leads have contact, source, market, and project all filled in`,
    },
    {
      key: "auto_logged_interactions",
      label: "% of interactions automatically logged",
      tracked: false,
      note: "Not tracked — timeline events don't yet have an automatic-vs-manual origin flag",
    },
    {
      key: "janus_feedback",
      label: "% of Janus recommendations accepted/edited/rejected",
      tracked: feedback.length > 0,
      value: feedback.length > 0 ? `${Math.round((usefulFeedback / feedback.length) * 100)}% marked useful` : undefined,
      note: `${feedback.length} feedback event(s) captured — this is useful/not-useful feedback, not a strict accept/edit/reject breakdown`,
    },
    {
      key: "dau_wau",
      label: "Daily and weekly active use of Apex Edge",
      tracked: true,
      value: `${dauCount} today / ${wauCount} this week (of ${userIds.length})`,
      note: "From real sign-in events, tracked from today onward — no history exists before this was added",
    },
    {
      key: "management_adoption",
      label: "Management adoption of Apex Vision and Janus",
      tracked: true,
      value: `${managementWauCount}/${managerAdminIds.length} managers/admins active this week`,
      note: "Sign-in activity only — doesn't yet distinguish which pages/features they actually used",
    },
    {
      key: "user_satisfaction",
      label: "User satisfaction with prioritisation and daily missions",
      tracked: false,
      note: "Not tracked — no in-app satisfaction survey exists yet",
    },
    {
      key: "aex_participation",
      label: "AEX participation, challenge completion, tier progression",
      tracked: true,
      value: `${usersWithPoints}/${userIds.length} earned points in last 30d · ${resolvedChallenges.length} challenge(s) resolved`,
      note: "Real AexPointEvent and Challenge data",
    },
  ];
}
