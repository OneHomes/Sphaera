import { NextResponse } from "next/server";
import { previewFinancialPlan } from "@/lib/finance/financialPlanningData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Validates an uploaded XLSX budget workbook (legacy flat sheet or the
// two-sheet Summary + Cost Head Budgets layout, both handled inside
// previewFinancialPlan()) against a chosen fiscal year and stashes a
// short-lived preview for a later /commit call. multipart/form-data with
// fields "file" (the XLSX) and "fy" (the fiscal year start, e.g. 2026) —
// mirrors app/api/inventory/units/[id]/documents/route.ts's upload
// pattern. Read-only against the DB (no plan rows are created yet), so
// no audit log entry here — finance_plan_committed covers the mutation.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const formData = await request.formData();
      const file = formData.get("file");
      const fy = formData.get("fy");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (fy === null) {
        return NextResponse.json({ error: "fy is required" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await previewFinancialPlan(buffer, file.name, fy);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(result);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
