import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getChangeHistory } from "@/lib/finance/changeJournal";
import { ChangeHistoryPage } from "@/components/finance/ChangeHistoryPage";

export const dynamic = "force-dynamic";

export default async function FinanceChangeHistoryRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const changes = await getChangeHistory();
    const rows = changes.map((c) => ({
      id: c.id,
      action: c.action,
      description: c.description,
      actorEmail: c.actorEmail,
      changedAt: c.changedAt.toISOString(),
      undoneAt: c.undoneAt ? c.undoneAt.toISOString() : null,
      undoneBy: c.undoneBy,
    }));
    return <ChangeHistoryPage initialChanges={rows} />;
  });
}
