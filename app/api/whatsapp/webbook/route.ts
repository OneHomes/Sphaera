import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp";
import { createNotification } from "@/lib/notifications";
// Meta calls this endpoint to (a) verify it during setup (GET), and
// (b) deliver incoming messages / delivery status updates (POST). This
// route deliberately has NO session/auth check — Meta's servers call it
// directly, not a signed-in Sphaera user. Its own verify-token check
// below is what stands in for authentication here.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const payload: WhatsAppWebhookPayload = await request.json();

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const { value } = change;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const agentNumber = await prisma.whatsAppNumber.findUnique({
          where: { phoneNumberId },
        });
        if (!agentNumber) continue; // message for a number we don't track

        // Incoming messages
        for (const msg of value.messages ?? []) {
          if (msg.type !== "text") continue; // MVP: text only for now

          const contactName = value.contacts?.find(
            (c) => c.wa_id === msg.from
          )?.profile.name;

          // Auto-link to an existing Lead by phone number, so managers
          // (via RBAC scoping already built for Lead/Opportunity) can
          // reason about "whose client is this" the same way as
          // everywhere else in the app.
          const matchingLead = await prisma.lead.findFirst({
            where: { contact: { contains: msg.from } },
          });

          const conversation = await prisma.whatsAppConversation.upsert({
            where: {
              agentNumberId_clientPhone: {
                agentNumberId: agentNumber.id,
                clientPhone: msg.from,
              },
            },
            create: {
              agentNumberId: agentNumber.id,
              clientPhone: msg.from,
              clientName: contactName,
              leadId: matchingLead?.id,
              lastMessageAt: new Date(Number(msg.timestamp) * 1000),
            },
            update: {
              lastMessageAt: new Date(Number(msg.timestamp) * 1000),
              ...(contactName ? { clientName: contactName } : {}),
            },
          });

                    await prisma.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              direction: "inbound",
              content: msg.text?.body ?? "",
              metaMessageId: msg.id,
              status: "delivered",
            },
          });

          await createNotification(
            agentNumber.userId,
            "whatsapp_message",
            `New message from ${contactName ?? msg.from}`,
            (msg.text?.body ?? "").slice(0, 80),
            "/messages"
          );
        }
        // Delivery/read status updates for messages we sent
        for (const status of value.statuses ?? []) {
          await prisma.whatsAppMessage
            .updateMany({
              where: { metaMessageId: status.id },
              data: { status: status.status },
            })
            .catch(() => {}); // best-effort; don't fail the whole webhook
        }
      }
    }
  } catch (err) {
    // Meta expects a 200 quickly regardless — log and move on rather
    // than retry-storming a broken payload.
    console.error("Error processing WhatsApp webhook payload:", err);
  }

  return NextResponse.json({ received: true });
}