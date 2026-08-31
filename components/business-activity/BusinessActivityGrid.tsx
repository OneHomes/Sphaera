import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/aexTransform";
import { formatRelativeTime } from "@/lib/leadTransform";
import { scoreBand } from "@/lib/leadData";
import { getAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { calculateProductivityIndex } from "@/lib/productivityIndex";
import type { AgentActivityRow } from "@/components/business-activity/AgentActivityTable";
import type { SourceActivityRow } from "@/components/business-activity/CampaignActivityTable";
import type { LeadActivityRow } from "@/components/business-activity/LeadActivityTable";
import type { CampaignHealth } from "@/lib/businessActivityData";

export const dynamic = "force-dynamic";

const QUALIFIED_OR_LATER = new Set([
  "Qualified",
  "Meeting Booked",
  "Opportunity",
  "Negotiation",
  "Closed Won",
]);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const scoreBandToTrend: Record<
  ReturnType<typeof scoreBand>,
  "up" | "flat" | "down"
> = {
  Hot: "up",
  Warm: "flat",
  Cool: "down",
};

type BusinessActivityGridProps = {
  agents: AgentActivityRow[];
  sources: SourceActivityRow[];
  leads: LeadActivityRow[];
};

function BusinessActivityGrid({
  agents,
  sources,
  leads,
}: BusinessActivityGridProps) {
  return (
    <div>
      <pre>{JSON.stringify({ agents: agents.length, sources: sources.length, leads: leads.length }, null, 2)}</pre>
    </div>
  );
}

export default async function BusinessActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);

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

  const [users, leads] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      include: {
        pointEvents: true,
        assignedOpportunities: { select: { value: true, stage: true } },
      },
    }),
    prisma.lead.findMany({
      where: getLeadScopeWhere(authUser),
      orderBy: { score: "desc" },
    }),
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

    return {
      id: u.id,
      name: u.name,
      status: isActive ? "Active" : "Inactive",
      tier: tierForPoints(points),
      pipelineValue,
      totalRevenue,
      productivityIndex: productivityIndexes[i].overall,
    };
  });

  // Lead Source Activity — grouped by real Lead.source (see
  // CampaignActivityTable.tsx comment on why this isn't true
  // campaign-level data yet).
  const sourceGroups = new Map<string, { total: number; qualified: number }>();
  for (const lead of leads) {
    const group = sourceGroups.get(lead.source) ?? { total: 0, qualified: 0 };
    group.total += 1;
    if (QUALIFIED_OR_LATER.has(lead.stage)) group.qualified += 1;
    sourceGroups.set(lead.source, group);
  }

  const sources: SourceActivityRow[] = Array.from(
    sourceGroups.entries()
  ).map(([source, { total, qualified }]) => {
    const qualifiedPercent = total > 0 ? Math.round((qualified / total) * 100) : 0;
    let health: CampaignHealth = "Alert";
    if (qualifiedPercent >= 60) health = "Good";
    else if (qualifiedPercent >= 40) health = "Satisfactory";

    return {
      source,
      leadCount: total,
      qualifiedCount: qualified,
      qualifiedPercent,
      health,
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
  }));

  return (
    <BusinessActivityGrid agents={agents} sources={sources} leads={leadRows} />
  );
}