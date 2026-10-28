import { NextResponse } from "next/server";
import { allocateBatch } from "@/lib/finance/peopleOverheadsData";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// v41 /api/people/allocate-batch: many payments to one employee, saved atomically as one undo.
export async function POST(request: Request) {
  return payrollRoute(async ({ userId, email, audit }) => {
    const body = await request.json();
    const result = await allocateBatch({ personId: String(body.personId ?? ""), items: body.items, actorId: userId, actorEmail: email });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await audit("people_allocate_batch", `Allocated ${result.payments} payments ($${result.allocatedUsd}) to one employee`, result.changeId);
    return NextResponse.json(result);
  });
}
