import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (_authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const whatsappNumber = await prisma.whatsAppNumber.findUnique({
        where: { userId: user.id },
      });

      if (!whatsappNumber || !whatsappNumber.verifiedAt) {
        return NextResponse.json(
          { error: "Connect your WhatsApp number in Settings first." },
          { status: 400 }
        );
      }

      const conversations = await prisma.whatsAppConversation.findMany({
        where: { agentNumberId: whatsappNumber.id },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      return NextResponse.json(
        conversations.map((c) => ({
          id: c.id,
          clientName: c.clientName ?? c.clientPhone,
          clientPhone: c.clientPhone,
          leadId: c.leadId,
          lastMessage: c.messages[0]?.content ?? "",
          lastMessageAt: c.lastMessageAt.toISOString(),
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
