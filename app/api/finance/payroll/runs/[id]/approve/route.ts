import { NextResponse } from "next/server";
import { approveRun } from "@/lib/finance/payrollData";
import { payrollRoute } from "@/lib/finance/payrollRoute";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return payrollRoute(async ({ email, audit }) => {
    const result = await approveRun(params.id, email);
    await audit("run_approved", `Approved payroll run; ${result.linked} employees linked to People records`, params.id);
    return NextResponse.json({ ok: true, ...result });
  });
}
