import { NextResponse } from "next/server";
import { askJanus } from "@/lib/janus";
import { getFinanceAnalyticsSummary } from "@/lib/finance/financeGrounding";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// "Ask Your Data" — the source app's OpenAI-based chat assistant,
// replaced with Sphaera's own Janus per the product decision for this
// port (no second LLM integration). Same grounding-only, no-hallucination
// contract as lib/janus.ts's other call sites (see app/api/janus/ask's
// system prompt) — Janus answers only from the Finance summary provided
// below, never invents figures, and states plainly when the data doesn't
// cover the question.
const FINANCE_SYSTEM_PROMPT = `You are Janus, answering questions about One Homes' Finance data inside Sphaera.

Rules:
- Only use the Finance summary data provided in this conversation as ground truth. Never invent figures, names, or facts not present in it.
- If the summary doesn't contain what's needed to answer, say so clearly rather than guessing or estimating.
- Be concise — this is read inside a working finance tool, not a report.
- Always repeat the relevant caution note(s) from the summary when your answer touches collections, historical debt, or payroll — never present a cash-basis figure as if it were sales revenue or GAAP income.
- Never speculate about any named individual's compensation, even if asked directly — the summary deliberately withholds this.
- When you cite a number, briefly note what it's based on (e.g. "from current operating spend across 11 recorded months").`;

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const question = String(body.question ?? "").trim();
      if (!question) {
        return NextResponse.json({ error: "question is required" }, { status: 400 });
      }
      const history: { role: "user" | "assistant"; content: string }[] = Array.isArray(body.history)
        ? body.history.slice(-10)
        : [];

      try {
        const summary = await getFinanceAnalyticsSummary();
        const answer = await askJanus([
          { role: "system", content: FINANCE_SYSTEM_PROMPT },
          { role: "system", content: summary },
          ...history,
          { role: "user", content: question },
        ]);
        return NextResponse.json({ answer });
      } catch (err) {
        console.error("Finance chat failed:", err);
        return NextResponse.json(
          {
            error: "Janus couldn't answer right now. Try again in a moment.",
            detail: err instanceof Error ? err.message : String(err),
          },
          { status: 502 }
        );
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
