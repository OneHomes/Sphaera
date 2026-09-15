import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { askJanus } from "@/lib/janus";

// PRD JN12 — Prompt Based Focus Orchestration. This is step 1 of 2:
// Janus PARSES a free-text instruction into a structured proposal only —
// it never applies anything itself. "Janus must not silently change
// allocation, targets, or campaign focus from an ambiguous prompt" (PRD).
// Step 2 (app/api/focus POST) is a separate, explicit confirm action the
// Manager/Admin takes after reviewing this proposal.
//
// Scoped to real Sphaera data (market/project/source) rather than true ad
// campaign data, which needs the still-missing Fabric/OneLake pipeline —
// e.g. "shift focus to Diyar leads this week" works; "shift focus to our
// Google Ads campaign" doesn't, because Sphaera has no campaign data yet.

const FOCUS_PARSE_PROMPT = `You parse a manager's team-focus instruction into strict JSON. Output ONLY valid JSON, nothing else — no markdown fences, no explanation.

Sphaera can only shift focus along data it actually has: "market" (currency/region code), "projectInterest" (project name), or "source" (lead source). If the instruction refers to something else (e.g. an ad campaign, since Sphaera has no campaign data), set "understood" to false and explain why in "reason".

JSON shape:
{
  "understood": boolean,
  "dimension": "market" | "projectInterest" | "source" | null,
  "value": string | null,
  "durationDays": number,
  "reason": string
}

Default durationDays to 7 if not specified. "reason" should be a short, human-readable explanation of what this focus change means, written for a manager to review before confirming — not a restatement of the instruction.`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.instruction || typeof body.instruction !== "string") {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  try {
    const raw = await askJanus([
      { role: "system", content: FOCUS_PARSE_PROMPT },
      { role: "user", content: body.instruction },
    ]);

    // Defensive: strip markdown fences if the model adds them despite
    // instructions not to.
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Focus proposal parse failed:", err);
    return NextResponse.json(
      {
        error: "Janus couldn't parse that instruction. Try rephrasing it more specifically.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
