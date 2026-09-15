import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askJanus } from "@/lib/janus";
import {
  getOnlineMeetingIdFromJoinUrl,
  listMeetingTranscripts,
  getTranscriptContentVtt,
} from "@/lib/graph";
import type { Lead, LeadNote, LeadTimelineEvent } from "@prisma/client";

const MEETING_RECAP_SYSTEM_PROMPT = `You are Janus, summarizing a completed Teams meeting inside Sphaera, One Homes' Intelligent Revenue Platform.

Rules:
- Only use the transcript and lead record provided as ground truth. Never invent facts, statistics, or client details not present in the provided context.
- Structure your answer with these exact headings, in this order:

Summary
A 2-3 sentence overview of what this meeting actually was — substantive business discussion, informal/off-topic chatter, or a mix. Say plainly if there was little or no real business content.

Topics Discussed
Bullet list of the actual substantive/business topics covered. If none, write "None — no substantive business topics were discussed."

Off-Topic / Non-Business Content
Bullet list flagging informal, unrelated, or off-topic remarks, kept separate so they're never confused with real business discussion. If none, write "None."

Action Items
Bullet list of concrete commitments or follow-ups, with an owner if the transcript makes one clear (e.g. "- Follow up with client on pricing — Owais"). If none were captured, write "None captured."

Sentiment & Keywords
One line in this exact format: "Sentiment: Positive|Neutral|Negative|Mixed — Keywords: word1, word2, word3". Base the sentiment strictly on the client's/prospect's tone in the transcript (not the agent's), and list 3-6 real keywords/phrases actually said (e.g. product names, objections raised, pricing terms). If there's no real client interaction to judge (purely off-topic/informal), write "Sentiment: N/A — Keywords: none".

Recommended Next Action
One line: the single most useful next step, or "No CRM follow-up needed" if the meeting had no business content.

- Keep it concise and factual — this becomes a permanent record on the lead's timeline.
- Never invent or imply a price, discount, or legal commitment beyond what was actually said in the transcript.`;

type MatchedLead = Lead & { notes: LeadNote[]; timelineEvents: LeadTimelineEvent[] };

// Strips WebVTT cue numbers and timestamp lines, keeping speaker-attributed
// dialogue as plain text — cheaper and cleaner for the model than raw VTT.
function vttToPlainText(vtt: string): string {
  return vtt
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "WEBVTT") return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (trimmed.includes("-->")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "No Microsoft Graph access token on this session." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { joinUrl, subject, attendeeEmails, startISO } = body;

  if (!joinUrl || !subject) {
    return NextResponse.json(
      { error: "joinUrl and subject are required" },
      { status: 400 }
    );
  }

  let onlineMeetingId: string | null;
  try {
    onlineMeetingId = await getOnlineMeetingIdFromJoinUrl(session.accessToken, joinUrl);
  } catch (err) {
    console.error("Failed to resolve online meeting id:", err);
    return NextResponse.json(
      { error: "Couldn't look up this meeting in Microsoft Graph." },
      { status: 502 }
    );
  }

  if (!onlineMeetingId) {
    return NextResponse.json(
      { error: "This event isn't a Teams meeting Graph recognizes." },
      { status: 404 }
    );
  }

  let transcriptVtt: string;
  try {
    const transcripts = await listMeetingTranscripts(session.accessToken, onlineMeetingId);
    if (transcripts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transcript found for this meeting. Recording/transcription has to be turned on inside Teams during the call for one to exist.",
        },
        { status: 404 }
      );
    }
    // Most recent transcript if a meeting somehow has more than one.
    const latest = transcripts[transcripts.length - 1];
    const vtt = await getTranscriptContentVtt(
      session.accessToken,
      onlineMeetingId,
      latest.id
    );
    transcriptVtt = vttToPlainText(vtt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("GraphAccessToTranscriptsDisabled")) {
      return NextResponse.json(
        {
          error:
            "Transcript API access is turned off for this tenant. Ask your Microsoft 365 admin to enable it in Teams Admin Center.",
        },
        { status: 403 }
      );
    }
    console.error("Failed to fetch meeting transcript:", err);
    return NextResponse.json(
      { error: "Failed to fetch the meeting transcript from Microsoft Graph." },
      { status: 502 }
    );
  }

  // Same attendee-email-first, subject-name-fallback matching as meeting prep.
  let matchedLead: MatchedLead | null = null;
  if (Array.isArray(attendeeEmails) && attendeeEmails.length > 0) {
    matchedLead = await prisma.lead.findFirst({
      where: { OR: attendeeEmails.map((email: string) => ({ contact: { contains: email } })) },
      include: {
        notes: { orderBy: { createdAt: "desc" }, take: 5 },
        timelineEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
      },
    });
  }
  if (!matchedLead) {
    const allLeads = await prisma.lead.findMany({ select: { id: true, name: true } });
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

  const groundingContext = `
Meeting: "${subject}" at ${startISO}

${matchedLead ? `Matched lead: ${matchedLead.name} (stage: ${matchedLead.stage})` : "No matching lead record found for this meeting's attendees or subject."}

Transcript:
${transcriptVtt}
`.trim();

  let recap: string;
  try {
    recap = await askJanus([
      { role: "system", content: MEETING_RECAP_SYSTEM_PROMPT },
      { role: "system", content: groundingContext },
      { role: "user", content: "Summarize this meeting." },
    ]);
  } catch (err) {
    console.error("Meeting recap generation failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't summarize this transcript. Try again in a moment." },
      { status: 502 }
    );
  }

  if (matchedLead) {
    await prisma.leadTimelineEvent.create({
      data: {
        leadId: matchedLead.id,
        type: "meeting",
        summary: `Meeting recap — "${subject}"\n\n${recap}`,
      },
    });
  }

  return NextResponse.json({ recap, matchedLeadId: matchedLead?.id ?? null });
}
