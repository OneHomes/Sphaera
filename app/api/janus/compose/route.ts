import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askJanus } from "@/lib/janus";
import { getAuthUser, canAccessRecord } from "@/lib/authz";

// PRD JN08 (Message and Follow-up Composer). Same grounding discipline as
// meeting-prep and the daily briefing: only real lead data goes in, and
// the system prompt explicitly forbids inventing commercial terms (PRD
// 19.6 Commercial Governance). The draft is never sent automatically —
// the calling UI always shows it for the user to edit/confirm before
// logging it as sent (PRD 4.9 Human Authority Over Material Actions).

const COMPOSER_SYSTEM_PROMPT = `You are Janus, drafting a follow-up message for a real-estate sales agent inside Sphaera to send to a lead.

Rules:
- Only use the data provided in this conversation as ground truth. Never invent facts, client details, or commitments not present in the provided context.
- Never include a specific price, discount, payment plan, availability promise, completion date, or any legal/investment-return claim — those must come from approved commercial sources, not this draft.
- Keep it warm, professional, and concise — a real message a person would send, not a template with placeholders.
- Output ONLY the message text, no preamble like "Here's a draft:" and no subject line.`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const body = await request.json();
  const { leadId, objective } = body;
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignedUser: true,
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
      timelineEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groundingContext = `
Lead: ${lead.name}
Stage: ${lead.stage}
Project interest: ${lead.projectInterest || "not recorded"}
Last logged reason for priority: ${lead.prioritizationReason ?? "none recorded"}
Objective for this message: ${objective || "a general, friendly follow-up"}

Recent notes:
${lead.notes.map((n) => `- (${n.author}) ${n.text}`).join("\n") || "- No notes recorded"}

Recent timeline events:
${lead.timelineEvents.map((e) => `- [${e.type}] ${e.summary}`).join("\n") || "- No timeline events recorded"}
`.trim();

  try {
    const draft = await askJanus([
      { role: "system", content: COMPOSER_SYSTEM_PROMPT },
      { role: "system", content: groundingContext },
      { role: "user", content: "Draft the message." },
    ]);

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Message composition failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't draft this message. Try again in a moment." },
      { status: 502 }
    );
  }
}
