import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getDepartmentCatalogue, listPayrollRuns } from "@/lib/finance/payrollData";
import { PayrollImportPage } from "@/components/finance/PayrollImportPage";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

export default async function FinancePayrollRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    if (!authUser.canAccessFinancePayroll) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-base-700 bg-base-900 p-5 text-center">
            <h1 className="text-sm font-medium text-ink-50">Payroll access required</h1>
            <p className="mt-1 text-xs text-ink-500">Ask an Admin to grant you payroll access to the Finance module to import payroll.</p>
          </div>
        </div>
      );
    }

    const [runs, departments] = await Promise.all([listPayrollRuns(), getDepartmentCatalogue()]);
    return <PayrollImportPage initialRuns={JSON.parse(JSON.stringify(runs))} departments={departments} />;
  });
}
