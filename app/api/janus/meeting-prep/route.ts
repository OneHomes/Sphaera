import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askJanus } from "@/lib/janus";
import type { Lead, LeadNote, LeadTimelineEvent } from "@prisma/client";

const MEETING_PREP_SYSTEM_PROMPT = `You are Janus, preparing a sales agent for an upcoming meeting inside Sphaera, One Homes' Intelligent Revenue Platform.

Rules:
- Only use the data provided in this conversation as ground truth. Never invent facts, statistics, or client details not present in the provided context.
- If no matching lead record was found, say so clearly and give general meeting-preparation advice instead of guessing who the client is.
- Structure your answer as: 1) Who you're meeting, 2) Where things stand, 3) Suggested talking points, 4) Anything to watch out for (overdue items, risk signals).
- Keep it concise — this will be read in the few minutes before a meeting starts.
- Never invent or imply a price, discount, or legal commitment.`;

type MatchedLead = Lead & { notes: LeadNote[]; timelineEvents: LeadTimelineEvent[] };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { subject, attendeeEmails, startISO } = body;

  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  // Try to match this meeting to a real Lead by attendee email first
  // (most reliable), falling back to a loose subject-contains-name match.
  let matchedLead: MatchedLead | null = null;

  if (Array.isArray(attendeeEmails) && attendeeEmails.length > 0) {
    matchedLead = await prisma.lead.findFirst({
      where: {
        OR: attendeeEmails.map((email: string) => ({
          contact: { contains: email },
        })),
      },
      include: {
        notes: { orderBy: { createdAt: "desc" }, take: 5 },
        timelineEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
      },
    });
  }

  if (!matchedLead) {
    const allLeads = await prisma.lead.findMany({
      select: { id: true, name: true },
    });
    const nameMatch = allLeads.find((l) =>
      subject.toLowerCase().includes(l.name.toLowerCase())
    );
    if (nameMatch) {
      matchedLead = await prisma.lead.findUnique({
        where: { id: nameMatch.id },
        include: {
          notes: { orderBy: { createdAt: "desc" }, take: 5 },
          timelineEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
        },
      });
    }
  }

  let groundingContext: string;
  if (matchedLead) {
    groundingContext = `
Meeting: "${subject}" at ${startISO}

Matched lead record (this is the ONLY real data available for this lead):
- Name: ${matchedLead.name}
- Contact: ${matchedLead.contact}
- Stage: ${matchedLead.stage}
- Score: ${matchedLead.score}
- Engagement: ${matchedLead.engagement}
- Priority: ${matchedLead.priority}
- Next action: ${matchedLead.nextAction ?? "none set"}
- Prioritization reason: ${matchedLead.prioritizationReason ?? "none recorded"}

Recent notes:
${matchedLead.notes.map((n) => `- (${n.author}) ${n.text}`).join("\n") || "- No notes recorded"}

Recent timeline events:
${matchedLead.timelineEvents.map((e) => `- [${e.type}] ${e.summary}`).join("\n") || "- No timeline events recorded"}
`.trim();
  } else {
    groundingContext = `Meeting: "${subject}" at ${startISO}\n\nNo matching lead record was found for this meeting's attendees or subject.`;
  }

  try {
    const answer = await askJanus([
      { role: "system", content: MEETING_PREP_SYSTEM_PROMPT },
      { role: "system", content: groundingContext },
      { role: "user", content: "Prepare me for this meeting." },
    ]);

    return NextResponse.json({
      brief: answer,
      matchedLeadId: matchedLead?.id ?? null,
    });
  } catch (err) {
    console.error("Meeting prep failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't prepare this meeting brief. Try again in a moment." },
      { status: 502 }
    );
  }
}