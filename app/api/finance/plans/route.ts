import { NextResponse } from "next/server";
import { financePlanData } from "@/lib/finance/financialPlanningData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// financePlanData() (lib/finance/financialPlanningData.ts) is a direct port
// of the source's plan_data() and takes no arguments — it always returns
// every plan plus every line and target, newest-first. There is no
// "fetch one fiscal year's plan" query in the ported business logic, so
// this route accepts optional ?fyStart=&version= query params and filters
// the full result down to match, rather than inventing a new data-layer
// query that doesn't exist in financialPlanningData.ts. With neither
// param supplied, the full unfiltered result is returned (matching the
// source's behaviour exactly).
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const fyStartParam = searchParams.get("fyStart");
      const versionParam = searchParams.get("version");

      const { plans, lines, targets } = await financePlanData();

      if (fyStartParam === null && versionParam === null) {
        return NextResponse.json({ plans, lines, targets });
      }

      let filteredPlans = plans;
      if (fyStartParam !== null) {
        const fyStart = Number(fyStartParam);
        if (!Number.isInteger(fyStart)) {
          return NextResponse.json({ error: "fyStart must be an integer" }, { status: 400 });
        }
        filteredPlans = filteredPlans.filter((p) => p.fyStart === fyStart);
      }
      if (versionParam !== null) {
        const version = Number(versionParam);
        if (!Number.isInteger(version)) {
          return NextResponse.json({ error: "version must be an integer" }, { status: 400 });
        }
        filteredPlans = filteredPlans.filter((p) => p.version === version);
      }

      const planIds = new Set(filteredPlans.map((p) => p.id));
      return NextResponse.json({
        plans: filteredPlans,
        lines: lines.filter((l) => planIds.has(l.planId)),
        targets: targets.filter((t) => planIds.has(t.planId)),
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
