import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getTraceState } from "@/lib/finance/paymentTraceData";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { PaymentTraceabilityPage } from "@/components/finance/PaymentTraceabilityPage";

export const dynamic = "force-dynamic";

export default async function FinanceTraceabilityRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const [state, finance] = await Promise.all([getTraceState(), getFinanceState()]);
    return (
      <PaymentTraceabilityPage
        state={state}
        transactions={finance.transactions}
        departments={finance.departments}
        costHeads={finance.managementCostHeads}
      />
    );
  });
}
