import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.playbook.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
