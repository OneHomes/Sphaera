import { NextResponse } from "next/server";
import { generateBudgetTemplate } from "@/lib/finance/financialPlanningData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Generates the blank annual budget XLSX template (Summary + Cost Head
// Budgets sheets) for a given fiscal year and streams it back as a file
// download rather than JSON. generateBudgetTemplate() throws a plain
// Error for an out-of-range year instead of returning a { ok: false }
// result, so that's caught here and reported as a 400.
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const fyParam = searchParams.get("fy");
      const year = Number(fyParam);
      if (fyParam === null || !Number.isInteger(year)) {
        return NextResponse.json({ error: "fy query param must be an integer fiscal year" }, { status: 400 });
      }

      let buffer: Buffer;
      try {
        buffer = await generateBudgetTemplate(year);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 400 }
        );
      }

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="budget-template-FY${year}.xlsx"`,
        },
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
