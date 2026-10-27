import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WeeklyCeoBriefPage } from "@/components/finance/WeeklyCeoBriefPage";

export const dynamic = "force-dynamic";

export default async function FinanceWeeklyBriefRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  return <WeeklyCeoBriefPage />;
}
