import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, canAccessRecord } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { askJanus } from "@/lib/janus";
import { uploadDocumentBlob } from "@/lib/blobStorage";
import { recordJanusAction } from "@/lib/janusPolicy";

// PRD AE16 — Proposal prep. Janus drafts a proposal grounded in the
// lead's real record and the company's own uploaded reference documents
// (price lists, payment plans, brochures) for the same project — it
// cannot invent a price or figure that isn't in that grounding data. The
// draft is never auto-saved: GET returns a draft for the user to review
// and edit, POST persists the (possibly edited) final version as a real
// Document, same human-confirmation pattern as JN08 Compose.

const PROPOSAL_SYSTEM_PROMPT = `You are Janus, drafting a client proposal for a real-estate sales agent inside Sphaera.

Rules:
- Only use the lead record and reference documents provided as ground truth. Never invent a price, unit number, payment term, or commitment not present in that data.
- If a needed figure (price, payment plan) isn't in the provided reference documents, say "see attached [document name]" or "to be confirmed" rather than inventing a number.
- Write in a professional, warm tone addressed to the client by name.
- Structure: greeting, why this property fits their interest, key details from the reference documents, next steps.
- Respond with ONLY raw JSON, no markdown fences: {"title": "<short title>", "body": "<HTML using <p>/<h2> tags>"}`;

async function loadGroundingContext(leadId: string, authUser: Awaited<ReturnType<typeof getFreshAuthUser>>) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { assignedUser: true, notes: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!lead) return { error: "Lead not found" as const };
  if (!canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)) {
    return { error: "Forbidden" as const };
  }

  const referenceDocs = await prisma.document.findMany({
    where: {
      docType: { in: ["Price List", "Payment Plan", "Brochure"] },
      OR: [{ relatedTo: lead.projectInterest }, { relatedTo: null }],
    },
    take: 5,
  });

  const context = `
Lead: ${lead.name}
Contact: ${lead.contact}
Project interest: ${lead.projectInterest}
Market: ${lead.market}
Stage: ${lead.stage}

Recent notes:
${lead.notes.map((n) => `- ${n.text}`).join("\n") || "- None"}

Reference documents available (names only — actual figures live in these documents, not repeated here):
${referenceDocs.map((d) => `- ${d.name} (${d.docType})`).join("\n") || "- None uploaded for this project yet"}
`.trim();

  return { lead, context };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  const grounding = await loadGroundingContext(params.id, authUser);
  if ("error" in grounding) {
    return NextResponse.json({ error: grounding.error }, { status: grounding.error === "Forbidden" ? 403 : 404 });
  }

  try {
    const raw = await askJanus([
      { role: "system", content: PROPOSAL_SYSTEM_PROMPT },
      { role: "user", content: grounding.context },
    ]);

    let title = `Proposal — ${grounding.lead.name}`;
    let body = `<p>${grounding.lead.name}, thank you for your interest in ${grounding.lead.projectInterest}.</p>`;
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "");
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.body === "string" && parsed.body.trim()) body = parsed.body.trim();
    } catch {
      body = `<p>${raw.replace(/\n+/g, "</p><p>")}</p>`;
    }

    return NextResponse.json({ title, body });
  } catch (err) {
    console.error("Proposal generation failed:", err);
    return NextResponse.json(
      { error: "Janus couldn't draft a proposal right now. Try again in a moment." },
      { status: 502 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  const user = await getOrCreateCurrentUser(session);

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { assignedUser: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const html = `<html><body>${body.body}</body></html>`;
  const buffer = Buffer.from(html, "utf-8");
  const blobName = `proposal-${lead.id}-${Date.now()}.html`;

  try {
    await uploadDocumentBlob(blobName, buffer, "text/html");
  } catch (err) {
    console.error("Blob upload failed:", err);
    return NextResponse.json(
      { error: "Failed to save the proposal to storage. Check Azure Storage configuration." },
      { status: 502 }
    );
  }

  const document = await prisma.document.create({
    data: {
      name: `${body.title}.html`,
      blobName,
      contentType: "text/html",
      sizeBytes: buffer.byteLength,
      docType: "Proposal",
      relatedTo: lead.name,
      uploadedById: user.id,
    },
    include: { uploadedBy: true },
  });

  await recordJanusAction(
    user.id,
    session.user?.email ?? "unknown",
    "proposal_generated",
    document.id,
    `Saved proposal "${body.title}" for ${lead.name} (reviewed and confirmed before saving)`
  );

  return NextResponse.json(document, { status: 201 });
}
