import { NextResponse } from "next/server";
import { getWeeklyBrief, weeklyBriefHtml } from "@/lib/finance/weeklyBrief";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// GET ?fy=2025 returns the brief as JSON; add &format=html for the printable report.
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const params = new URL(request.url).searchParams;
      const year = Number(params.get("fy"));
      if (!Number.isInteger(year) || year < 2015 || year > 2050) {
        return NextResponse.json({ error: "Invalid FY" }, { status: 400 });
      }
      const report = await getWeeklyBrief(year, await getUserDepartmentScope(authUser.id));
      if (params.get("format") === "html") {
        return new NextResponse(weeklyBriefHtml(report), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return NextResponse.json(report);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
