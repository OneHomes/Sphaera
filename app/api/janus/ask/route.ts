import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, canAccessRecord, getLeadScopeWhere } from "@/lib/authz";
import { askJanus } from "@/lib/janus";
import { calculateProductivityIndex } from "@/lib/productivityIndex";

// PRD JN02 (Natural Language Business Questions) — grounding-only, no
// hallucination (mitigates R03). Janus answers ONLY from data explicitly
// included in this request's context, never invents facts, and states
// clearly when data is missing rather than guessing.
const JANUS_SYSTEM_PROMPT = `You are Janus, the persistent AI business analyst inside Sphaera, One Homes' Intelligent Revenue Platform.

Rules:
- Only use the data provided in this conversation as ground truth. Never invent facts, numbers, or client details not present in the provided context.
- If the answer isn't in the provided data, say so clearly rather than guessing.
- Be concise — this is read inside a working app, not a report.
- Never invent or imply a price, discount, or legal commitment.
- When you cite a number, briefly note what it's based on (e.g. "from your 12 assigned leads").`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = await getFreshAuthUser(session);
  const body = await request.json();
  const { question, scope, leadId, conversationId, userId: targetUserId } = body;

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // PRD JN13 — resume an existing conversation (verifying ownership) or
  // start a new one. Only the last 10 messages are replayed as context —
  // enough for real follow-up questions without the prompt growing
  // unbounded over a long-lived thread.
  let conversation;
  if (conversationId) {
    conversation = await prisma.janusConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: -10 } },
    });
    if (!conversation || conversation.userId !== authUser.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  } else {
    conversation = await prisma.janusConversation.create({
      data: { userId: authUser.id },
      include: { messages: true },
    });
  }

  let groundingContext = "";

  try {
    if (scope === "leadId" && leadId) {
      // ---- Lead-specific scope ----
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedUser: true,
          notes: { orderBy: { createdAt: "desc" }, take: 10 },
          timelineEvents: { orderBy: { occurredAt: "desc" }, take: 15 },
        },
      });

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      if (
        !canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      groundingContext = `
Lead: ${lead.name}
Contact: ${lead.contact}
Source: ${lead.source} · Market: ${lead.market}
Stage: ${lead.stage} · Score: ${lead.score} · Priority: ${lead.priority} · Engagement: ${lead.engagement}
Next action: ${lead.nextAction ?? "none set"}
Assigned to: ${lead.assignedUser?.name ?? "Unassigned"}

Notes:
${lead.notes.map((n) => `- (${n.author}) ${n.text}`).join("\n") || "- None"}

Timeline:
${lead.timelineEvents.map((e) => `- [${e.type}] ${e.summary}`).join("\n") || "- None"}
`.trim();
    } else if (scope === "pipeline") {
      // ---- Pipeline scope ----
      const opportunities = await prisma.opportunity.findMany({
        where:
          authUser.role === "ADMIN"
            ? {}
            : authUser.role === "MANAGER" && authUser.teamId
              ? { assignedUser: { teamId: authUser.teamId } }
              : { assignedUserId: authUser.id },
        include: { assignedUser: true },
      });

      groundingContext = `Pipeline (${opportunities.length} opportunities):\n${opportunities
        .map(
          (o) =>
            `- ${o.leadName}: $${o.value.toLocaleString()}, ${o.stage}, ${o.probability}% probability, assigned to ${o.assignedUser?.name ?? "Unassigned"}`
        )
        .join("\n")}`;
    } else if (scope === "aex") {
      // ---- AEX scope (own performance, or — PRD AV08 — a manager/admin
      // requesting a coaching read on a specific team member) ----
      const subjectId = targetUserId ?? authUser.id;

      if (targetUserId && targetUserId !== authUser.id) {
        const subject = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!subject || !canAccessRecord(authUser, subject.id, subject.teamId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: subjectId },
        include: {
          pointEvents: { orderBy: { createdAt: "desc" }, take: 20 },
          badges: true,
          streaks: true,
        },
      });

      const totalPoints = user?.pointEvents.reduce((s, e) => s + e.points, 0) ?? 0;
      const subjectLabel = targetUserId && targetUserId !== authUser.id ? `${user?.name}'s` : "Your";

      groundingContext = `
${subjectLabel} AEX status:
Total points: ${totalPoints}
Recent point events:
${user?.pointEvents.map((e) => `- ${e.label}: +${e.points}`).join("\n") || "- None"}

Badges: ${user?.badges.map((b) => b.name).join(", ") || "None"}
Streaks: ${user?.streaks.map((s) => `${s.label} (${s.currentCount})`).join(", ") || "None"}
`.trim();
    } else if (scope === "management") {
      // ---- Management scope (PRD AV12/JN11) — aggregate team/company
      // data for Manager/Admin general questions ("who is the most
      // productive agent", "share team pipeline") that the plain `leads
      // visible to you` general scope below doesn't cover. Team-scoped
      // for Manager, company-wide for Admin, same as getLeadScopeWhere.
      const userWhere =
        authUser.role === "MANAGER" && authUser.teamId
          ? { teamId: authUser.teamId }
          : authUser.role === "ADMIN"
            ? {}
            : { id: authUser.id };

      const users = await prisma.user.findMany({
        where: userWhere,
        include: { assignedOpportunities: true },
      });

      const productivity = await Promise.all(
        users.map(async (u) => ({
          name: u.name,
          role: u.role,
          pi: (await calculateProductivityIndex(u.id)).overall,
        }))
      );

      const opportunities = await prisma.opportunity.findMany({
        where:
          authUser.role === "ADMIN"
            ? {}
            : authUser.role === "MANAGER" && authUser.teamId
              ? { assignedUser: { teamId: authUser.teamId } }
              : { assignedUserId: authUser.id },
      });

      const pipelineValue = opportunities
        .filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
        .reduce((sum, o) => sum + o.value, 0);
      const revenue = opportunities
        .filter((o) => o.stage === "Closed Won")
        .reduce((sum, o) => sum + o.value, 0);

      const leads = await prisma.lead.findMany({ where: getLeadScopeWhere(authUser) });
      const overdueLeads = leads.filter(
        (l) => l.nextActionDueAt && l.nextActionDueAt < new Date()
      ).length;

      groundingContext = `
Team/company overview (${authUser.role === "ADMIN" ? "company-wide" : "your team"}):
Agents and Productivity Index (0-100, higher is better):
${productivity.map((p) => `- ${p.name} (${p.role}): PI ${p.pi}`).join("\n") || "- No agents found"}

Pipeline value (open): $${pipelineValue.toLocaleString()}
Revenue (Closed Won): $${revenue.toLocaleString()}
Total leads in scope: ${leads.length}, of which ${overdueLeads} have an overdue next action.
`.trim();
    } else {
      // ---- General scope: aggregate leads visible to this user ----
      const leads = await prisma.lead.findMany({
        where: getLeadScopeWhere(authUser),
        include: { assignedUser: true },
        take: 50,
      });

      groundingContext = `Leads visible to you (${leads.length} total, showing up to 50):\n${leads
        .map(
          (l) =>
            `- ${l.name}: ${l.stage}, score ${l.score}, priority ${l.priority}, assigned to ${l.assignedUser?.name ?? "Unassigned"}`
        )
        .join("\n")}`;
    }

    const priorMessages = conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const answer = await askJanus([
      { role: "system", content: JANUS_SYSTEM_PROMPT },
      { role: "system", content: groundingContext },
      ...priorMessages,
      { role: "user", content: question },
    ]);

    await prisma.janusMessage.createMany({
      data: [
        { conversationId: conversation.id, role: "user", content: question },
        { conversationId: conversation.id, role: "assistant", content: answer },
      ],
    });
    // Touch updatedAt so "most recent conversation" ordering reflects
    // actual activity, not just creation time.
    await prisma.janusConversation.update({
      where: { id: conversation.id },
      data: {},
    });

    return NextResponse.json({ answer, conversationId: conversation.id });
  } catch (err) {
    console.error("Janus ask failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't answer right now. Try again in a moment." },
      { status: 502 }
    );
  }
}