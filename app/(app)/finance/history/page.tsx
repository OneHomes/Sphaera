import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getChangeHistory } from "@/lib/finance/changeJournal";
import { prisma } from "@/lib/prisma";
import { ChangeHistoryPage } from "@/components/finance/ChangeHistoryPage";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

export default async function FinanceChangeHistoryRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    const [changes, auditEntries] = await Promise.all([
      getChangeHistory(),
      prisma.auditLog.findMany({ where: { action: { startsWith: "finance_" } }, orderBy: { createdAt: "desc" }, take: 150 }),
    ]);
    const rows = changes.map((c) => ({
      id: c.id,
      action: c.action,
      description: c.description,
      actorEmail: c.actorEmail,
      changedAt: c.changedAt.toISOString(),
      undoneAt: c.undoneAt ? c.undoneAt.toISOString() : null,
      undoneBy: c.undoneBy,
    }));
    const auditRows = auditEntries.map((a) => ({
      id: a.id,
      action: a.action.replace(/^finance_/, ""),
      paymentId: a.targetId,
      actorEmail: a.actorEmail,
      createdAt: a.createdAt.toISOString(),
    }));
    return <ChangeHistoryPage initialChanges={rows} auditEntries={auditRows} />;
  });
}
