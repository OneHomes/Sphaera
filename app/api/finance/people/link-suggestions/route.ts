import { NextResponse } from "next/server";
import { linkSuggestions } from "@/lib/finance/peopleOverheadsData";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// v41 /api/people/link-suggestions: attribute reviewed name/alias matches, one undoable change.
export async function POST(request: Request) {
  return payrollRoute(async ({ userId, email, audit }) => {
    const body = await request.json();
    const result = await linkSuggestions({ transactionIds: body.transactionIds, actorId: userId, actorEmail: email });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await audit("people_link_suggestions", `Linked ${result.linked} suggested payroll payments ($${result.totalUsd})`, result.changeId);
    return NextResponse.json(result);
  });
}
