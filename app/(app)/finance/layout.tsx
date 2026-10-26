import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { FinanceShell } from "@/components/finance/FinanceShell";

export const dynamic = "force-dynamic";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (!authUser.canAccessFinance) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-base-700 bg-base-900 p-5 text-center">
            <h1 className="text-sm font-medium text-ink-50">Finance access required</h1>
            <p className="mt-1 text-xs text-ink-500">
              Ask an Admin to grant you access to the Finance module.
            </p>
          </div>
        </div>
      );
    }

    return <FinanceShell canAccessFinancePayroll={authUser.canAccessFinancePayroll}>{children}</FinanceShell>;
  });
}
