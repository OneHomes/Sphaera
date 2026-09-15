import { prisma } from "./prisma";

export type NotificationType =
  | "lead_assigned"
  | "opportunity_assigned"
  | "task_assigned"
  | "whatsapp_message"
  | "manager_assist_requested"
  | "lead_note_mention"
  | "challenge_update"
  | "risk_critical";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  href?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, href },
    });
  } catch (err) {
    // Notifications are a best-effort side effect — a failure here
    // should never break the primary action (assigning a lead, sending
    // a message, etc.) that triggered it.
    console.error("Failed to create notification:", err);
  }
}