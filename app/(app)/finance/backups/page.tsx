import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState, countFinanceImports } from "@/lib/finance/ledgerData";
import { DataBackupsPage } from "@/components/finance/DataBackupsPage";

export const dynamic = "force-dynamic";

// Backup/restore is payroll-gated, same posture as People Costs — it can
// contain People Costs data, so it needs a stricter check than the general
// canAccessFinance gate the layout already applies to the rest of /finance.
export default async function FinanceBackupsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (!authUser.canAccessFinancePayroll) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-base-700 bg-base-900 p-5 text-center">
            <h1 className="text-sm font-medium text-ink-50">Payroll access required</h1>
            <p className="mt-1 text-xs text-ink-500">
              Ask an Admin to grant you Payroll access to use Data &amp; Backups.
            </p>
          </div>
        </div>
      );
    }

    const [state, importedFilesCount] = await Promise.all([getFinanceState(), countFinanceImports()]);
    return <DataBackupsPage state={state} importedFilesCount={importedFilesCount} />;
  });
}
