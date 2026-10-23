import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.notification.count({
          where: { userId: user.id, isRead: false },
        }),
      ]);

      return NextResponse.json({
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
