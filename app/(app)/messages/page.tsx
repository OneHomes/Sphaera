import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { MessagesPage as MessagesPageComponent } from "@/components/messages/MessagesPage";

export const dynamic = "force-dynamic";

export default async function MessagesRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);
  const whatsappNumber = await prisma.whatsAppNumber.findUnique({
    where: { userId: user.id },
  });

  if (!whatsappNumber || !whatsappNumber.verifiedAt) {
    return (
      <div className="p-6 text-sm text-ink-500">
        Connect your WhatsApp Business number in{" "}
        <a href="/settings" className="text-ink-300 underline">
          Settings
        </a>{" "}
        to use Messages.
      </div>
    );
  }

  return <MessagesPageComponent connectedNumber={whatsappNumber.phoneNumber} />;
}