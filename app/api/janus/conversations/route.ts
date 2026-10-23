import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD JN01 acceptance criteria — "the user can start a new conversation
// or return to a recent authorized conversation." Recent-first, one
// preview line each (first user message).
export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      const conversations = await prisma.janusConversation.findMany({
        where: { userId: authUser.id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      });

      return NextResponse.json(
        conversations.map((c) => ({
          id: c.id,
          updatedAt: c.updatedAt,
          preview: c.messages[0]?.content.slice(0, 80) ?? "New conversation",
        }))
      );
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
