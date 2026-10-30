import { NextResponse } from "next/server";
import { getPersonCostState, savePerson } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Read-only summary joining every person-cost allocation back to its
// source payment and employee, for the People Costs screen.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const state = await getPersonCostState();
      return NextResponse.json(state);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Create/update an employee record.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await savePerson({
        id: body.id !== undefined ? String(body.id) : undefined,
        name: String(body.name ?? ""),
        department: String(body.department ?? ""),
        jobTitle: String(body.jobTitle ?? ""),
        email: String(body.email ?? ""),
        paymentAlias: String(body.paymentAlias ?? ""),
        active: body.active,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_people_person_saved",
        targetId: result.id,
        details: `Saved employee record "${body.name}"`,
      });
      return NextResponse.json({ ok: true, id: result.id });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
