import { NextResponse } from "next/server";
import { projection } from "@/lib/finance/creditCycleData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Cash-outflow forecast — direct wrapper around projection(). Query params:
//   start           YYYY-MM-DD (defaults to today, inside projection())
//   months          1-18 (defaults to 4, inside projection())
//   includePayroll  "false" to exclude Salary-category recurring bills from
//                   the projection (defaults to true/included). This is a
//                   read-only filter on a forward-looking projection, not a
//                   mutation of payroll data, so it does not require
//                   canAccessFinancePayroll — every viewer with general
//                   Finance access can see (or hide) the payroll line the
//                   same way they can see any other cost category here.
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const start = searchParams.get("start") ?? undefined;
      const monthsParam = searchParams.get("months");
      const includePayrollParam = searchParams.get("includePayroll");

      const result = await projection({
        start,
        months: monthsParam !== null ? Number(monthsParam) : undefined,
        includePayroll: includePayrollParam !== null ? includePayrollParam !== "false" : undefined,
      });
      return NextResponse.json(result);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
