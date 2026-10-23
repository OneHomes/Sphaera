import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      const conversation = await prisma.janusConversation.findUnique({
        where: { id: params.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      if (!conversation || conversation.userId !== authUser.id) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: conversation.id,
        messages: conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      });
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
