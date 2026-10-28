import { NextResponse } from "next/server";
import { deleteDraftRun, getPayrollRun, updateDraftRun } from "@/lib/finance/payrollData";
import { payrollRoute } from "@/lib/finance/payrollRoute";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return payrollRoute(async () => {
    const run = await getPayrollRun(params.id);
    return run ? NextResponse.json(run) : NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return payrollRoute(async ({ audit }) => {
    const body = await request.json();
    await updateDraftRun(params.id, { payPeriod: body.payPeriod, lines: body.lines });
    const what = [body.payPeriod !== undefined ? `pay period ${body.payPeriod ?? "cleared"}` : null, body.lines?.length ? `${body.lines.length} row(s)` : null].filter(Boolean).join(", ");
    await audit("run_updated", `Updated draft payroll run: ${what}`, params.id);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return payrollRoute(async ({ audit }) => {
    await deleteDraftRun(params.id);
    await audit("run_deleted", "Deleted draft payroll run", params.id);
    return NextResponse.json({ ok: true });
  });
}
