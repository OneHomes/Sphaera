import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { ROLES, type Role } from "@/lib/roles";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const existing = await prisma.user.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const data: {
        role?: Role;
        teamId?: string | null;
        canExportData?: boolean;
        canAccessFinance?: boolean;
        canAccessFinancePayroll?: boolean;
      } = {};

      if ("role" in body) {
        if (!ROLES.includes(body.role)) {
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        data.role = body.role;
      }

      if ("teamId" in body) {
        data.teamId = body.teamId || null;
      }

      if ("canExportData" in body) {
        data.canExportData = !!body.canExportData;
      }

      if ("canAccessFinance" in body) {
        data.canAccessFinance = !!body.canAccessFinance;
      }

      if ("canAccessFinancePayroll" in body) {
        data.canAccessFinancePayroll = !!body.canAccessFinancePayroll;
      }

      const updated = await prisma.user.update({
        where: { id: params.id },
        data,
      });

      const changeDescriptions: string[] = [];
      if (data.role && data.role !== existing.role) {
        changeDescriptions.push(`role: ${existing.role} -> ${data.role}`);
      }
      if ("teamId" in data && data.teamId !== existing.teamId) {
        changeDescriptions.push(`team: ${existing.teamId ?? "none"} -> ${data.teamId ?? "none"}`);
      }
      if (data.canExportData !== undefined && data.canExportData !== existing.canExportData) {
        changeDescriptions.push(`export rights: ${existing.canExportData} -> ${data.canExportData}`);
      }
      if (data.canAccessFinance !== undefined && data.canAccessFinance !== existing.canAccessFinance) {
        changeDescriptions.push(`finance access: ${existing.canAccessFinance} -> ${data.canAccessFinance}`);
      }
      if (
        data.canAccessFinancePayroll !== undefined &&
        data.canAccessFinancePayroll !== existing.canAccessFinancePayroll
      ) {
        changeDescriptions.push(
          `finance payroll access: ${existing.canAccessFinancePayroll} -> ${data.canAccessFinancePayroll}`
        );
      }

      if (changeDescriptions.length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: authUser.id,
            actorEmail: session.user?.email ?? "unknown",
            action: "user_role_or_team_change",
            targetId: params.id,
            details: `Changed for ${existing.email}: ${changeDescriptions.join(", ")}`,
          },
        });
      }

      return NextResponse.json({
        id: updated.id,
        role: updated.role,
        teamId: updated.teamId,
        canExportData: updated.canExportData,
        canAccessFinance: updated.canAccessFinance,
        canAccessFinancePayroll: updated.canAccessFinancePayroll,
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
