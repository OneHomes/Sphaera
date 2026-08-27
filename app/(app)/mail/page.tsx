import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMailMessages, type GraphMailMessage } from "@/lib/graph";
import { MailPage as MailPageComponent } from "@/components/mail/MailPage";

export const dynamic = "force-dynamic";

export default async function MailRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  // The temporary email/password testing login (lib/auth.ts) never gets a
  // Graph access token — only real Microsoft sign-in does. Handle that
  // gracefully instead of crashing.
  if (!session.accessToken) {
    return (
      <div className="p-6 text-sm text-ink-500">
        Mail requires signing in with Microsoft. The testing email/password
        login doesn&apos;t grant Microsoft Graph access.
      </div>
    );
  }

  let messages: GraphMailMessage[] = [];
  let error: string | null = null;

  try {
    messages = await listMailMessages(session.accessToken, 25);
  } catch (err) {
    error =
      "Couldn't load mail from Microsoft Graph. Try signing out and back in.";
    console.error(err);
  }

  if (error) {
    return <div className="p-6 text-sm text-status-inactive">{error}</div>;
  }

  return <MailPageComponent initialMessages={messages} />;
}