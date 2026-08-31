import { prisma } from "./prisma";
import { calculateActual, type TargetMetric } from "./targetTracker";
import type { AuthUser } from "./authz";

export type RiskAlert = {
  id: string;
  category: "target" | "opportunity" | "agent_workload" | "stale_lead";
  severity: "critical" | "warning";
  title: string;
  subtitle: string;
  href: string;
};

// PLACEHOLDER THRESHOLDS — not business-approved, same governance
// pattern as everywhere else in this build (AEX tiers, allocation caps,
// Productivity Index weights). PRD AV13 requires configurable risk
// thresholds signed off by the business owner before UAT.
const OVERDUE_ITEMS_WARNING = 3;
const OVERDUE_ITEMS_CRITICAL = 6;
const AT_RISK_PROBABILITY_THRESHOLD = 40;
const STALE_LEAD_DAYS = 14;
const TARGET_GAP_WARNING = 20;
const TARGET_GAP_CRITICAL = 35;

export async function getRiskAlerts(authUser: AuthUser): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];
  const now = new Date();

  // Scope: Admin sees everyone; Manager sees their own team only.
  const userWhere =
    authUser.role === "MANAGER" && authUser.teamId
      ? { teamId: authUser.teamId }
      : authUser.role === "ADMIN"
        ? {}
        : { id: authUser.id }; // fail-safe to self only

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      assignedLeads: true,
      tasks: { where: { completed: false } },
    },
  });
  const userIds = users.map((u) => u.id);

  // ---- 1. Targets behind pace ----
  const targetWhere =
    authUser.role === "MANAGER" && authUser.teamId
      ? { OR: [{ teamId: authUser.teamId }, { userId: { in: userIds } }] }
      : authUser.role === "ADMIN"
        ? {}
        : { userId: authUser.id };

  const targets = await prisma.target.findMany({
    where: {
      ...targetWhere,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
    include: { team: true, user: true },
  });

  for (const target of targets) {
    const scopeUserIds = target.userId
      ? [target.userId]
      : users.filter((u) => u.teamId === target.teamId).map((u) => u.id);
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
    const gap = expectedPercent - percentComplete;

    if (gap >= TARGET_GAP_WARNING) {
      alerts.push({
        id: `target-${target.id}`,
        category: "target",
        severity: gap >= TARGET_GAP_CRITICAL ? "critical" : "warning",
        title: `${target.user ? target.user.name : (target.team?.name ?? "Team")} — ${target.metric} target behind pace`,
        subtitle: `${Math.round(percentComplete)}% complete, expected ~${Math.round(expectedPercent)}%`,
        href: "/targets",
      });
    }
  }

  // ---- 2. At-risk opportunities ----
  const opportunities = await prisma.opportunity.findMany({
    where: {
      assignedUserId: { in: userIds },
      stage: { notIn: ["Closed Won", "Closed Lost"] },
      probability: { lt: AT_RISK_PROBABILITY_THRESHOLD },
    },
    include: { assignedUser: true },
  });

  for (const opp of opportunities) {
    alerts.push({
      id: `opp-${opp.id}`,
      category: "opportunity",
      severity: opp.probability < 20 ? "critical" : "warning",
      title: `${opp.leadName} — at risk (${opp.probability}% probability)`,
      subtitle: `$${opp.value.toLocaleString()} · ${opp.assignedUser?.name ?? "Unassigned"} · ${opp.stage}`,
      href: "/pipeline",
    });
  }

  // ---- 3. Agent workload (overdue leads + tasks) ----
  for (const user of users) {
    const overdueLeads = user.assignedLeads.filter(
      (l) => l.nextActionDueAt && l.nextActionDueAt < now
    ).length;
    const overdueTasks = user.tasks.filter(
      (t) => t.dueAt && t.dueAt < now
    ).length;
    const total = overdueLeads + overdueTasks;

    if (total >= OVERDUE_ITEMS_WARNING) {
      alerts.push({
        id: `workload-${user.id}`,
        category: "agent_workload",
        severity: total >= OVERDUE_ITEMS_CRITICAL ? "critical" : "warning",
        title: `${user.name} — ${total} overdue items`,
        subtitle: `${overdueLeads} overdue leads, ${overdueTasks} overdue tasks`,
        href: "/business-activity",
      });
    }
  }

  // ---- 4. Stale (un-contacted) leads ----
  const staleCutoff = new Date(now.getTime() - STALE_LEAD_DAYS * 86_400_000);
  const staleLeads = await prisma.lead.findMany({
    where: {
      assignedUserId: { in: userIds },
      OR: [
        { lastInteractionAt: null },
        { lastInteractionAt: { lt: staleCutoff } },
      ],
    },
    include: { assignedUser: true },
  });

  for (const lead of staleLeads) {
    alerts.push({
      id: `stale-${lead.id}`,
      category: "stale_lead",
      severity: "warning",
      title: `${lead.name} — no contact in ${STALE_LEAD_DAYS}+ days`,
      subtitle: `${lead.assignedUser?.name ?? "Unassigned"} · ${lead.stage}`,
      href: `/leads/${lead.id}`,
    });
  }

  const severityRank = { critical: 0, warning: 1 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return alerts;
}