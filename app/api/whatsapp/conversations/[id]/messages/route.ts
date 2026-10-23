import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { sendTextMessage } from "@/lib/whatsapp";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (_authUser, session) => {
      const user = await getOrCreateCurrentUser(session);

      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: params.id },
        include: {
          agentNumber: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Only the agent who owns this WhatsApp number can view their
      // conversations — no separate scoping table needed since it's a direct
      // one-to-one ownership check.
      if (conversation.agentNumber.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json(
        conversation.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          content: m.content,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
        }))
      );
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (_authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const body = await request.json();
      const text: string | undefined = body.text;

      if (!text || !text.trim()) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }

      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: params.id },
        include: { agentNumber: { include: { config: true } } },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      if (conversation.agentNumber.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      try {
        const { messageId } = await sendTextMessage(
          conversation.agentNumber.phoneNumberId,
          conversation.agentNumber.config.systemUserToken,
          conversation.clientPhone,
          text.trim()
        );

        const message = await prisma.whatsAppMessage.create({
          data: {
            conversationId: conversation.id,
            direction: "outbound",
            content: text.trim(),
            metaMessageId: messageId,
            status: "sent",
          },
        });

        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        return NextResponse.json(
          {
            id: message.id,
            direction: message.direction,
            content: message.content,
            status: message.status,
            createdAt: message.createdAt.toISOString(),
          },
          { status: 201 }
        );
      } catch (err) {
        console.error("Failed to send WhatsApp message:", err);
        return NextResponse.json(
          { error: "Failed to send message via WhatsApp" },
          { status: 502 }
        );
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
