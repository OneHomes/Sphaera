import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Opening the bare site URL must not ask a signed-in user to sign in again: their session
// cookie is still valid, so send them into the app (the (app) layout handles onboarding).
export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/sign-in");
}
