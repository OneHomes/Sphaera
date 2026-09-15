import { prisma } from "./prisma";
import { calculateProductivityIndex } from "./productivityIndex";
import { calculateActual, type TargetMetric } from "./targetTracker";
import { getRiskAlerts } from "./riskCentre";
import { pipelineStages } from "./pipelineData";
import type { AuthUser } from "./authz";

export type PipelineStageSummary = {
  stage: string;
  count: number;
  value: number;
};

export type TeamPerformanceSummary = {
  teamId: string;
  teamName: string;
  memberCount: number;
  totalPipelineValue: number;
  totalRevenue: number;
  avgProductivityIndex: number;
};

export type ExecutiveSummary = {
  totalActivePipelineValue: number;
  totalClosedRevenueThisYear: number;
  totalActiveLeads: number;
  totalAgents: number;
  totalTeams: number;
  pipelineByStage: PipelineStageSummary[];
  teamPerformance: TeamPerformanceSummary[];
  criticalRiskCount: number;
  warningRiskCount: number;
  targetsOnPaceCount: number;
  targetsBehindPaceCount: number;
  // PRD AV04 — weighted forecast: sum(value * probability%) across open
  // opportunities, real Opportunity.probability (no ML model behind it
  // yet, just the stage-set probability already on each record).
  weightedForecastValue: number;
  // Scope label so the UI can say "company-wide" vs "your team" rather
  // than hardcoding it — set based on which branch computed this summary.
  scope: "company" | "team";
};

const CLOSED_STAGES = new Set(["Closed Won", "Closed Lost"]);

export async function getExecutiveSummary(
  authUser: AuthUser
): Promise<ExecutiveSummary> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // PRD AV01/AV03 — Admin sees company-wide; Manager sees their own team
  // only (this used to ignore authUser entirely and always return
  // everything, which is why /executive was Admin-only until now).
  const isCompanyWide = authUser.role === "ADMIN";
  const userTeamIdWhere = isCompanyWide || !authUser.teamId ? {} : { teamId: authUser.teamId };
  const teamSelfWhere = isCompanyWide || !authUser.teamId ? {} : { id: authUser.teamId };
  const opportunityTeamWhere =
    isCompanyWide || !authUser.teamId ? {} : { assignedUser: { teamId: authUser.teamId } };

  const [opportunities, leads, teams, allUsers, riskAlerts, targets] =
    await Promise.all([
      prisma.opportunity.findMany({ where: opportunityTeamWhere }),
      prisma.lead.findMany({ where: opportunityTeamWhere }),
      prisma.team.findMany({ where: teamSelfWhere, include: { members: true } }),
      prisma.user.findMany({
        where: userTeamIdWhere,
        include: { assignedOpportunities: true },
      }),
      getRiskAlerts(authUser),
      prisma.target.findMany({
        where: {
          periodStart: { lte: now },
          periodEnd: { gte: now },
          ...(isCompanyWide || !authUser.teamId
            ? {}
            : { OR: [{ teamId: authUser.teamId }, { user: { teamId: authUser.teamId } }] }),
        },
        include: { team: { include: { members: true } } },
      }),
    ]);

  // ---- Company-wide KPIs ----
  const totalActivePipelineValue = opportunities
    .filter((o) => !CLOSED_STAGES.has(o.stage))
    .reduce((sum, o) => sum + o.value, 0);

  // ---- Weighted forecast (PRD AV04) — real Opportunity.probability per
  // record, no separate ML forecast model behind it yet. ----
  const weightedForecastValue = opportunities
    .filter((o) => !CLOSED_STAGES.has(o.stage))
    .reduce((sum, o) => sum + o.value * (o.probability / 100), 0);

  const totalClosedRevenueThisYear = opportunities
    .filter((o) => o.stage === "Closed Won" && o.updatedAt >= yearStart)
    .reduce((sum, o) => sum + o.value, 0);

  // ---- Pipeline by stage ----
  const stageMap = new Map<string, { count: number; value: number }>();
  for (const stage of pipelineStages) {
    stageMap.set(stage, { count: 0, value: 0 });
  }
  for (const opp of opportunities) {
    const entry = stageMap.get(opp.stage) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += opp.value;
    stageMap.set(opp.stage, entry);
  }
  const pipelineByStage = Array.from(stageMap.entries()).map(
    ([stage, v]) => ({ stage, ...v })
  );

  // ---- Team performance (avg PI computed per member, then averaged) ----
  const teamPerformance: TeamPerformanceSummary[] = [];
  for (const team of teams) {
    if (team.members.length === 0) continue;

    const memberIds = team.members.map((m) => m.id);
    const teamOpportunities = allUsers
      .filter((u) => memberIds.includes(u.id))
      .flatMap((u) => u.assignedOpportunities);

    const totalPipelineValue = teamOpportunities
      .filter((o) => !CLOSED_STAGES.has(o.stage))
      .reduce((sum, o) => sum + o.value, 0);
    const totalRevenue = teamOpportunities
      .filter((o) => o.stage === "Closed Won")
      .reduce((sum, o) => sum + o.value, 0);

    const piResults = await Promise.all(
      memberIds.map((id) => calculateProductivityIndex(id))
    );
    const avgProductivityIndex = Math.round(
      piResults.reduce((sum, r) => sum + r.overall, 0) / piResults.length
    );

    teamPerformance.push({
      teamId: team.id,
      teamName: team.name,
      memberCount: team.members.length,
      totalPipelineValue,
      totalRevenue,
      avgProductivityIndex,
    });
  }
  teamPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---- Targets on-pace vs behind (company-wide) ----
  let targetsOnPaceCount = 0;
  let targetsBehindPaceCount = 0;
  for (const target of targets) {
    const scopeUserIds = target.userId
      ? [target.userId]
      : (target.team?.members.map((m) => m.id) ?? []);
    if (scopeUserIds.length === 0) continue;

    const actual = await calculateActual(
      target.metric as TargetMetric,
      scopeUserIds,
      target.periodStart,
      target.periodEnd
    );
    const percentComplete =
      target.targetValue > 0 ? (actual / target.targetValue) * 100 : 0;
    const totalDays = Math.max(
      1,
      Math.round(
        (target.periodEnd.getTime() - target.periodStart.getTime()) /
          86_400_000
      )
    );
    const daysElapsed = Math.max(
      0,
      Math.round((now.getTime() - target.periodStart.getTime()) / 86_400_000)
    );
    const expectedPercent = Math.min(100, (daysElapsed / totalDays) * 100);

    if (percentComplete >= expectedPercent) targetsOnPaceCount += 1;
    else targetsBehindPaceCount += 1;
  }

  return {
    totalActivePipelineValue,
    totalClosedRevenueThisYear,
    totalActiveLeads: leads.length,
    totalAgents: allUsers.filter((u) => u.role === "AGENT").length,
    totalTeams: teams.length,
    pipelineByStage,
    teamPerformance,
    criticalRiskCount: riskAlerts.filter((a) => a.severity === "critical")
      .length,
    warningRiskCount: riskAlerts.filter((a) => a.severity === "warning")
      .length,
    targetsOnPaceCount,
    targetsBehindPaceCount,
    weightedForecastValue,
    scope: isCompanyWide ? "company" : "team",
  };
}