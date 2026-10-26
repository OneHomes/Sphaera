import { NextResponse } from "next/server";
import { getRecurring, upsertRecurring, deleteRecurring } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();

      // Payroll gate applies if EITHER the record's existing category or
      // the incoming category is Salary — otherwise someone without payroll
      // access could edit a salary entry's amount/schedule without ever
      // touching the category field, or re-categorize a salary entry away
      // from Salary to dodge the gate.
      const existing = await getRecurring(params.id);
      if (!existing) {
        return NextResponse.json({ error: "Recurring rule not found" }, { status: 404 });
      }
      const touchesSalary = existing.category === "Salary" || body.category === "Salary";
      if (touchesSalary && !authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await upsertRecurring({
        id: params.id,
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
        action: "finance_credit_recurring_updated",
        targetId: result.id,
        details: `Updated recurring bill ${result.id}`,
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const existing = await getRecurring(params.id);
      if (!existing) {
        return NextResponse.json({ error: "Recurring rule not found" }, { status: 404 });
      }
      if (existing.category === "Salary" && !authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await deleteRecurring(params.id);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_credit_recurring_deleted",
        targetId: params.id,
        details: `Deleted recurring bill ${params.id} (${existing.category})`,
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
