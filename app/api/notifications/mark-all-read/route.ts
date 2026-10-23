import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST() {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);

      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
