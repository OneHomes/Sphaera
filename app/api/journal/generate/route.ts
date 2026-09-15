import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { askJanus } from "@/lib/janus";
import { journalFolders, type JournalFolder } from "@/lib/journalData";

// Janus-authored journal note (reference UI's "New Note" AI action). This
// is the one place Janus is allowed to freely generate prose rather than
// only ground itself in real data — a journal entry is the user's own
// private draft, not a business answer, so there's nothing to hallucinate
// "facts" about. The prompt still asks for plain, grounded reflection
// rather than invented business figures.
const GENERATION_SYSTEM_PROMPT = `You are Janus, the AI assistant inside Sphaera's Journal. The user will give you a short prompt describing what they want to write about. Write a short, natural journal entry in their voice (first person, reflective, 3-5 short paragraphs).

Respond with ONLY raw JSON, no markdown fences, in exactly this shape:
{"title": "<a short 3-8 word title>", "body": "<the entry as simple HTML using <p> tags for paragraphs>"}

Do not invent specific business figures, client names, or commitments — keep it general and personal unless the user's prompt supplies specifics.`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const body = await request.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const folder: JournalFolder = journalFolders.includes(body.folder)
    ? body.folder
    : "Personal";

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const raw = await askJanus([
      { role: "system", content: GENERATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ]);

    let title = "Untitled note";
    let html = `<p>${prompt}</p>`;
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "");
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.body === "string" && parsed.body.trim()) html = parsed.body.trim();
    } catch {
      // Model didn't return clean JSON — fall back to using the raw
      // text as the body rather than failing the whole request.
      title = prompt.slice(0, 60);
      html = `<p>${raw.replace(/\n+/g, "</p><p>")}</p>`;
    }

    const entry = await prisma.journalEntry.create({
      data: { authorId: user.id, folder, title, body: html },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("Journal AI generation failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't generate that note right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
