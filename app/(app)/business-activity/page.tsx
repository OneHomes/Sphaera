import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/aexTransform";
import { getAexConfig } from "@/lib/aexConfig";
import { formatRelativeTime } from "@/lib/leadTransform";
import { scoreBand, isQualifiedOrLater } from "@/lib/leadData";
import { getFreshAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { calculateProductivityIndex } from "@/lib/productivityIndex";
import { BusinessActivityGrid } from "@/components/business-activity/BusinessActivityGrid";
import type { AgentActivityRow } from "@/components/business-activity/AgentActivityTable";
import type { SourceActivityRow } from "@/components/business-activity/CampaignActivityTable";
import type { LeadActivityRow } from "@/components/business-activity/LeadActivityTable";
import {
  mockHash,
  mockEfficiency,
  mockBpm,
  LIVE_ACTIVITY_POOL,
  type CampaignHealth,
} from "@/lib/businessActivityData";

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const scoreBandToTrend: { Hot: "up" | "flat" | "down"; Warm: "up" | "flat" | "down"; Cool: "up" | "flat" | "down" } = {
  Hot: "up",
  Warm: "flat",
  Cool: "down",
};

export default async function BusinessActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

   const authUser = await getFreshAuthUser(session);

  // Business Activity is a management/oversight view (PRD's Apex Vision,
  // not Apex Edge) — Agents shouldn't have it at all, not just a
  // filtered version of it.
  if (authUser.role === "AGENT") {
    redirect("/dashboard");
  }

  // Manager sees only their own team's users; Admin sees everyone.
  const userWhere =
    authUser.role === "MANAGER" && authUser.teamId
      ? { teamId: authUser.teamId }
      : {};

  const [users, leads, aexConfig] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      include: {
        team: true,
        pointEvents: true,
        assignedOpportunities: { select: { value: true, stage: true } },
      },
    }),
    prisma.lead.findMany({
      where: getLeadScopeWhere(authUser),
      orderBy: { score: "desc" },
      include: { assignedUser: { select: { name: true } } },
    }),
    getAexConfig(),
  ]);
  // Agent Activity — real per-user pipeline/revenue via assigned
  // opportunities; status derived from recent AEX activity (a real
  // signal) as a proxy for "active" since true telephony/messaging
  // presence isn't connected yet. Productivity Index (real, per PRD
  // 14.3) is computed per user in parallel below.
  const productivityIndexes = await Promise.all(
    users.map((u) => calculateProductivityIndex(u.id))
  );

  const agents: AgentActivityRow[] = users.map((u, i) => {
    const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
    const mostRecentEvent = u.pointEvents.reduce<Date | null>((latest, e) => {
      return !latest || e.createdAt > latest ? e.createdAt : latest;
    }, null);
    const isActive =
      mostRecentEvent !== null &&
      Date.now() - mostRecentEvent.getTime() < ONE_DAY_MS;

    const pipelineValue = u.assignedOpportunities
      .filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
      .reduce((sum, o) => sum + o.value, 0);
    const totalRevenue = u.assignedOpportunities
      .filter((o) => o.stage === "Closed Won")
      .reduce((sum, o) => sum + o.value, 0);

    // Live Activity + Context — mock, no telephony/presence signal
    // exists yet (see AgentActivityTable's footnote). Team is real.
    const liveActivity = LIVE_ACTIVITY_POOL[mockHash(u.id) % LIVE_ACTIVITY_POOL.length];

    return {
      id: u.id,
      name: u.name,
      status: isActive ? "Active" : "Inactive",
      tier: tierForPoints(points, aexConfig.tierThresholds),
      pipelineValue,
      totalRevenue,
      productivityIndex: productivityIndexes[i].overall,
      liveActivity: liveActivity.label,
      context: liveActivity.context,
      trend: liveActivity.trend,
      team: u.team?.name ?? "Unassigned",
    };
  });

  // Lead Source Activity — grouped by real Lead.source (see
  // CampaignActivityTable.tsx comment on why this isn't true
  // campaign-level data yet).
  const sourceGroups = new Map<string, { total: number; qualified: number }>();
  for (const lead of leads) {
    const group = sourceGroups.get(lead.source) ?? { total: 0, qualified: 0 };
    group.total += 1;
    if (isQualifiedOrLater(lead.stage)) group.qualified += 1;
    sourceGroups.set(lead.source, group);
  }

  const sources: SourceActivityRow[] = Array.from(
    sourceGroups.entries()
  ).map(([source, { total, qualified }]) => {
    const qualifiedPercent = total > 0 ? Math.round((qualified / total) * 100) : 0;
    let health: CampaignHealth = "Alert";
    if (qualifiedPercent >= 60) health = "Good";
    else if (qualifiedPercent >= 40) health = "Satisfactory";

    // Discontinued and Efficiency are mock — no real campaign spend/CTR
    // data exists yet (see CampaignActivityTable's footnote). Every 4th
    // source (by stable hash, not array position) rolls into the
    // Discontinued mock state so the grayed-out toggle has something to
    // render, matching the reference UI.
    if (mockHash(source) % 4 === 3) health = "Discontinued";

    return {
      source,
      leadCount: total,
      qualifiedCount: qualified,
      qualifiedPercent,
      health,
      efficiency: mockEfficiency(source),
    };
  });

  // Lead Activity — real leads. "Health" trend is a proxy from score band
  // (Hot/Warm/Cool), not a true historical trend (see table footnote).
  const leadRows: LeadActivityRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    health: scoreBandToTrend[scoreBand(lead.score)],
    engagement: lead.engagement as LeadActivityRow["engagement"],
    assignment: lead.assignment,
    activity: formatRelativeTime(lead.lastInteractionAt),
    leadOwner: lead.assignedUser?.name ?? "Unassigned",
    bpm: mockBpm(lead.id), // undefined PRD metric — mock
  }));

  return (
    <BusinessActivityGrid agents={agents} sources={sources} leads={leadRows} />
  );
}