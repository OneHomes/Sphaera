import { NextResponse } from "next/server";
import { listRecurring, upsertRecurring } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const activeOnly = searchParams.get("activeOnly") === "true";
      const recurring = await listRecurring(activeOnly ? { activeOnly: true } : undefined);
      return NextResponse.json({ recurring });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();

      // Salary-category recurring bills carry personnel-cost data, so
      // creating one additionally requires the payroll flag — every other
      // bill type (Rent/Tax/Loan/Utility/Subscription/Other) only needs
      // general Finance access. Mirrors the source app's payroll gate on
      // this one specific category.
      if (body.category === "Salary" && !authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await upsertRecurring({
        title: body.title,
        category: body.category,
        beneficiary: body.beneficiary,
        country: body.country,
        currency: body.currency,
        amount: body.amount,
        paymentSourceId: body.paymentSourceId,
        recurrenceRule: body.recurrenceRule,
        dayOfMonth: body.dayOfMonth,
        weekday: body.weekday,
        ordinal: body.ordinal,
        startDate: body.startDate,
        endDate: body.endDate,
        active: body.active,
        notes: body.notes,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_credit_recurring_created",
        targetId: result.id,
        details: `Created recurring bill "${body.title ?? ""}" (${body.category ?? ""})`,
      });
      return NextResponse.json(result, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
