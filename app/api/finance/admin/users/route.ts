import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Admin-only: add a person to Finance in one step (name, email, Finance/Payroll
// access and department scope). One Homes signs in with Microsoft, so no password is set:
// when this email first signs in, lib/currentUser.ts finds this row by email and uses it.
// An email that already belongs to a user in this organization just gets the access.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (authUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const name = String(body.name ?? "").trim().slice(0, 160);
      const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
      const canAccessFinancePayroll = body.canAccessFinancePayroll === true;
      const departments: string[] = Array.isArray(body.departments)
        ? Array.from(new Set(body.departments.map((d: unknown) => String(d).trim()).filter(Boolean)))
        : [];

      if (name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
      }

      const existing = await prisma.user.findFirst({ where: { email } });
      const user = await prisma.$transaction(async (tx) => {
        const saved = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: { canAccessFinance: true, canAccessFinancePayroll },
            })
          : await tx.user.create({
              data: {
                organizationId: authUser.organizationId,
                name,
                email,
                // People added from Finance are always Agents (One Homes' decision); an
                // Admin can still change the role later under Admin > Users.
                role: "AGENT",
                canAccessFinance: true,
                canAccessFinancePayroll,
              },
            });
        await tx.financeDepartmentAccess.deleteMany({ where: { userId: saved.id } });
        if (departments.length) {
          await tx.financeDepartmentAccess.createMany({
            data: departments.map((department) => ({ userId: saved.id, department })),
          });
        }
        return saved;
      });

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: existing ? "finance_user_access_granted" : "finance_user_created",
        targetId: user.id,
        details: `${existing ? "Granted Finance access to" : "Added"} ${email}${canAccessFinancePayroll ? " with Payroll" : ""}; departments: ${departments.length ? departments.join(", ") : "all"}`,
      });

      return NextResponse.json({ ok: true, userId: user.id, existed: !!existing });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
