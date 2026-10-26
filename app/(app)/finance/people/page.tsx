import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getPersonCostState } from "@/lib/finance/peopleOverheadsData";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { PeopleCostsPage } from "@/components/finance/PeopleCostsPage";

export const dynamic = "force-dynamic";

export default async function FinancePeopleRoute() {
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
              Ask an Admin to grant you payroll access to the Finance module to view People Costs.
            </p>
          </div>
        </div>
      );
    }

    const [state, finance] = await Promise.all([getPersonCostState(), getFinanceState()]);
    return <PeopleCostsPage state={state} departments={finance.departments} />;
  });
}
