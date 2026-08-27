import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askJanus } from "@/lib/janus";
import { formatRelativeTime, formatDueLabel } from "@/lib/leadTransform";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { tierForPoints, nextTierInfo } from "@/lib/aexTransform";

const JANUS_SYSTEM_PROMPT = `You are Janus, the persistent AI business analyst inside Sphaera, an Intelligent Revenue Platform for One Homes real estate sales teams.

Rules you must follow:
- Only use the data provided to you in this conversation as ground truth. Never invent facts, statistics, or client details that are not present in the provided context.
- If the provided data is insufficient to answer confidently, say so explicitly rather than guessing.
- Keep answers concise and business-focused — this is being read by a busy sales agent or manager, not a chatbot enthusiast.
- Never invent or imply a price, discount, or legal commitment; if asked about commercial terms, say that requires human/manager approval.`;

async function buildGeneralLeadsContext(): Promise<string> {
  const leads = await prisma.lead.findMany({ orderBy: { score: "desc" } });

  if (leads.length === 0) {
    return "There are currently no leads in the system.";
  }

  const byStage = new Map<string, number>();
  const bySource = new Map<string, number>();
  const overdue: string[] = [];

  for (const lead of leads) {
    byStage.set(lead.stage, (byStage.get(lead.stage) ?? 0) + 1);
    bySource.set(lead.source, (bySource.get(lead.source) ?? 0) + 1);

    if (formatDueLabel(lead.nextActionDueAt) === "Overdue") {
      overdue.push(
        `- ${lead.name} (${lead.stage}, ${lead.priority} priority) — next action: ${lead.nextAction ?? "none set"}`
      );
    }
  }

  const topLeads = leads
    .slice(0, 5)
    .map(
      (lead) =>
        `- ${lead.name}: score ${lead.score}, stage ${lead.stage}, engagement ${lead.engagement}, last interaction ${formatRelativeTime(lead.lastInteractionAt)}, next action: ${lead.nextAction ?? "none set"}`
    );

  const stageBreakdown = Array.from(byStage.entries())
    .map(([stage, count]) => `${stage}: ${count}`)
    .join(", ");
  const sourceBreakdown = Array.from(bySource.entries())
    .map(([source, count]) => `${source}: ${count}`)
    .join(", ");

  return `
Real lead data snapshot (this is the ONLY real data available — do not add anything not listed here):

Total leads: ${leads.length}
By stage: ${stageBreakdown}
By source: ${sourceBreakdown}

Overdue leads (next action due date has passed):
${overdue.length > 0 ? overdue.join("\n") : "- None currently overdue"}

Top 5 leads by score:
${topLeads.join("\n")}
`.trim();
}

async function buildLeadSpecificContext(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
      timelineEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
    },
  });

  if (!lead) {
    return "The requested lead record could not be found.";
  }

  return `
Lead record (this is the ONLY real data available for this lead — do not add anything not listed here):
- Name: ${lead.name}
- Contact: ${lead.contact}
- Source: ${lead.source}
- Market: ${lead.market}
- Project interest: ${lead.projectInterest}
- Stage: ${lead.stage}
- Score: ${lead.score}
- Engagement: ${lead.engagement}
- Priority: ${lead.priority}
- Assignment: ${lead.assignment}
- Next action: ${lead.nextAction ?? "none set"}
- Prioritization reason: ${lead.prioritizationReason ?? "none recorded"}

Recent notes:
${lead.notes.map((n) => `- (${n.author}) ${n.text}`).join("\n") || "- No notes recorded"}

Recent timeline events:
${lead.timelineEvents.map((e) => `- [${e.type}] ${e.summary}`).join("\n") || "- No timeline events recorded"}
`.trim();
}

async function buildPipelineContext(): Promise<string> {
  const opportunities = await prisma.opportunity.findMany({
    include: { assignedUser: true },
    orderBy: { value: "desc" },
  });

  if (opportunities.length === 0) {
    return "There are currently no opportunities in the pipeline.";
  }

  const byStage = new Map<string, { count: number; value: number }>();
  let totalActiveValue = 0;
  const atRisk: string[] = [];

  for (const opp of opportunities) {
    const entry = byStage.get(opp.stage) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += opp.value;
    byStage.set(opp.stage, entry);

    if (opp.stage !== "Closed Won" && opp.stage !== "Closed Lost") {
      totalActiveValue += opp.value;
      if (opp.probability < 40) {
        atRisk.push(
          `- ${opp.leadName} (${opp.stage}, ${opp.probability}% probability, $${opp.value.toLocaleString()})`
        );
      }
    }
  }

  const stageBreakdown = Array.from(byStage.entries())
    .map(
      ([stage, { count, value }]) =>
        `${stage}: ${count} opportunities, $${value.toLocaleString()}`
    )
    .join("\n");

  const topOpportunities = opportunities
    .slice(0, 5)
    .map(
      (o) =>
        `- ${o.leadName}: $${o.value.toLocaleString()}, ${o.stage}, ${o.probability}% probability, assigned to ${o.assignedUser?.name ?? "Unassigned"}`
    );

  return `
Real pipeline data snapshot (this is the ONLY real data available — do not add anything not listed here):

Total active pipeline value: $${totalActiveValue.toLocaleString()}
Total opportunities: ${opportunities.length}

By stage:
${stageBreakdown}

At-risk opportunities (below 40% probability, still active):
${atRisk.length > 0 ? atRisk.join("\n") : "- None currently flagged as at-risk"}

Top 5 opportunities by value:
${topOpportunities.join("\n")}
`.trim();
}

async function buildAexContext(userId: string): Promise<string> {
  const [pointEvents, badges, streaks, pointsAgg] = await Promise.all([
    prisma.aexPointEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.userBadge.findMany({ where: { userId } }),
    prisma.userStreak.findMany({ where: { userId } }),
    prisma.aexPointEvent.aggregate({
      where: { userId },
      _sum: { points: true },
    }),
  ]);

  const totalPoints = pointsAgg._sum.points ?? 0;
  const tier = tierForPoints(totalPoints);
  const { nextTier, pointsToNextTier } = nextTierInfo(totalPoints);

  return `
Real AEX (performance/gamification) data snapshot for the current user — this is the ONLY real data available:

Current tier: ${tier}
Total points: ${totalPoints}
${nextTier ? `Points needed for ${nextTier}: ${pointsToNextTier}` : "Already at the highest tier"}

Badges earned:
${badges.length > 0 ? badges.map((b) => `- ${b.name}: ${b.description}`).join("\n") : "- No badges earned yet"}

Active streaks:
${streaks.length > 0 ? streaks.map((s) => `- ${s.label}: ${s.currentCount} (${s.resetRule})`).join("\n") : "- No active streaks"}

Recent point events:
${pointEvents.length > 0 ? pointEvents.map((e) => `- ${e.label}: +${e.points}`).join("\n") : "- No recent point activity"}
`.trim();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const question: string | undefined = body.question;
  const leadId: string | undefined = body.leadId;
  const scope: string | undefined = body.scope;

  if (!question || !question.trim()) {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 }
    );
  }

  let groundingContext: string;

  if (leadId) {
    groundingContext = await buildLeadSpecificContext(leadId);
  } else if (scope === "pipeline") {
    groundingContext = await buildPipelineContext();
  } else if (scope === "aex") {
    const user = await getOrCreateCurrentUser(session);
    groundingContext = await buildAexContext(user.id);
  } else {
    groundingContext = await buildGeneralLeadsContext();
  }

  try {
    const answer = await askJanus([
      { role: "system", content: JANUS_SYSTEM_PROMPT },
      { role: "system", content: groundingContext },
      { role: "user", content: question },
    ]);

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Janus request failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't process that request. Try again in a moment." },
      { status: 502 }
    );
  }
}