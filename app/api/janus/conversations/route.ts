import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authz";

// PRD JN01 acceptance criteria — "the user can start a new conversation
// or return to a recent authorized conversation." Recent-first, one
// preview line each (first user message).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

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
}
