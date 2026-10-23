import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const existing = await prisma.notification.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (existing.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const updated = await prisma.notification.update({
        where: { id: params.id },
        data: { isRead: true },
      });

      return NextResponse.json(updated);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
