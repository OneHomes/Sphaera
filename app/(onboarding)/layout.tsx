import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { shouldShowWelcome } from "@/lib/dailyWelcome";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  // This route had no role gate at all — any signed-in user (Admin
  // included) could hit /onboarding directly. Onboarding is an
  // Agent-only daily sequence (PRD AE01), same rule as the (app) layout's
  // gate, checked against the fresh DB role for the same reason (a role
  // change shouldn't require a re-login to take effect).
  const dbUser = await getOrCreateCurrentUser(session);
  if (dbUser.role !== "AGENT") {
    redirect("/command");
  }

  // Also bounce back if today's sequence is already done — otherwise
  // manually revisiting /onboarding (or a stale bookmark/back-button)
  // would force an agent to redo it.
  if (!shouldShowWelcome(dbUser, (session as { signedInAt?: number }).signedInAt)) {
    redirect("/command");
  }

  return <>{children}</>;
}
