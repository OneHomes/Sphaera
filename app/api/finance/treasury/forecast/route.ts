import { NextResponse } from "next/server";
import { getTreasuryForecast } from "@/lib/finance/treasuryForecast";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const months = new URL(request.url).searchParams.get("months") ?? "3";
      if (!["1", "3", "12"].includes(months)) {
        return NextResponse.json({ error: "Horizon must be 1, 3 or 12 months" }, { status: 400 });
      }
      const data = await getTreasuryForecast(Number(months) as 1 | 3 | 12, Boolean(authUser.canAccessFinancePayroll));
      return NextResponse.json(data);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
