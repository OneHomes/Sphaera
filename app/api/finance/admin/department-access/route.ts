import { NextResponse } from "next/server";
import { listDepartmentAccess, setUserDepartmentAccess } from "@/lib/finance/departmentAccess";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Admin-only: manage which Finance users are scoped to specific
// departments ("Head of Department" access). Requires ADMIN role, not
// just canAccessFinance — this is an access-control management surface.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (authUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const entries = await listDepartmentAccess();
      return NextResponse.json({ entries });
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
      if (authUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const userId = String(body.userId ?? "");
      const departments = Array.isArray(body.departments) ? body.departments.map(String) : [];
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      const result = await setUserDepartmentAccess({ userId, departments });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_department_access_updated",
        targetId: userId,
        details:
          departments.length > 0
            ? `Scoped Finance access for user ${userId} to: ${departments.join(", ")}`
            : `Removed department scoping for user ${userId} (now sees all departments)`,
      });

      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
