import { prisma } from "./prisma";

export type MostInDemandRow = {
  projectInterest: string;
  interested: number;
  totalValue: number;
};

export type MonthlySalesPoint = { month: string; closedValue: number };
export type ProductivityPoint = { hour: string; count: number };

export type DashboardMetrics = {
  mostInDemand: MostInDemandRow[];
  activeLeads: number;
  uncontactedLeads: number;
  monthlySales: MonthlySalesPoint[];
  productivityByHour: ProductivityPoint[];
  avgDealSize: number;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Most in Demand is intentionally company-wide (not scoped to the
// current user) — market demand for a project/unit type is a shared
// signal, not a personal one. Everything else here is personal (per PRD
// AE05 — this is the individual agent's own dashboard, distinct from the
// team-wide Business Activity view).
export async function getDashboardMetrics(
  userId: string
): Promise<DashboardMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3_600_000);

  const [myLeads, allOpportunities, myOpportunities, contactEvents] =
    await Promise.all([
      prisma.lead.findMany({ where: { assignedUserId: userId } }),
      prisma.opportunity.findMany(),
      prisma.opportunity.findMany({ where: { assignedUserId: userId } }),
      prisma.leadTimelineEvent.findMany({
        where: {
          lead: { assignedUserId: userId },
          type: { in: ["call", "email", "meeting"] },
          occurredAt: { gte: thirtyDaysAgo },
        },
        select: { occurredAt: true },
      }),
    ]);

  // ---- Most in Demand ----
  // ---- Most in Demand ----
  type DemandEntry = { interested: number; totalValue: number };
  const demandMap = new Map<string, DemandEntry>();
  for (const opp of allOpportunities) {
    const key = opp.projectInterest || "Unspecified";
    const entry = demandMap.get(key) ?? { interested: 0, totalValue: 0 };
    entry.interested += 1;
    entry.totalValue += opp.value;
    demandMap.set(key, entry);
  }
  const mostInDemand = Array.from(demandMap.entries())
    .map(([projectInterest, v]) => ({ projectInterest, ...v }))
    .sort((a, b) => b.interested - a.interested)
    .slice(0, 6);

  // ---- Active / Un-contacted Leads (personal) ----
  const activeLeads = myLeads.length;
  const uncontactedLeads = myLeads.filter(
    (l) => l.lastInteractionAt === null
  ).length;

  // ---- Monthly Sales (personal, current year, Closed Won by updatedAt) ----
  // Uses updatedAt as a proxy for "when closed" — Opportunity has no
  // dedicated closedAt field. Reasonable since our PATCH endpoint bumps
  // updatedAt exactly when stage changes, including to Closed Won.
  const currentYear = new Date().getFullYear();
  const monthlyTotals = new Array(12).fill(0);
  for (const opp of myOpportunities) {
    if (
      opp.stage === "Closed Won" &&
      opp.updatedAt.getFullYear() === currentYear
    ) {
      monthlyTotals[opp.updatedAt.getMonth()] += opp.value;
    }
  }
  const monthlySales = MONTH_LABELS.map((month, i) => ({
    month,
    closedValue: monthlyTotals[i],
  }));

  // ---- Productivity by Hour (personal, last 30 days) ----
  const hourCounts = new Array(24).fill(0);
  for (const event of contactEvents) {
    hourCounts[event.occurredAt.getHours()] += 1;
  }
  const productivityByHour = hourCounts.map((count, hour) => ({
    hour: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`,
    count,
  }));

  // ---- Avg Deal Size (personal) — replaces "Average CPL", which would
  // require real ad-spend data we don't have; fabricating a number
  // there would violate the no-invented-data discipline of this build.
  const avgDealSize =
    myOpportunities.length > 0
      ? myOpportunities.reduce((sum, o) => sum + o.value, 0) /
        myOpportunities.length
      : 0;

  return {
    mostInDemand,
    activeLeads,
    uncontactedLeads,
    monthlySales,
    productivityByHour,
    avgDealSize,
  };
}