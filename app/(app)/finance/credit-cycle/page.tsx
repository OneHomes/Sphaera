import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { listInvoices, listRecurring, listCardRules, listCardCharges, projection } from "@/lib/finance/creditCycleData";
import { CreditCyclePage } from "@/components/finance/CreditCyclePage";

export const dynamic = "force-dynamic";

export default async function FinanceCreditCycleRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const [invoices, recurring, forecast, cardRules, cardCharges] = await Promise.all([
      listInvoices(),
      listRecurring(),
      projection(),
      listCardRules(),
      listCardCharges(),
    ]);

    return (
      <CreditCyclePage
        invoices={invoices}
        recurring={recurring}
        forecast={forecast}
        cardRules={cardRules}
        cardCharges={cardCharges}
        canAccessFinancePayroll={authUser.canAccessFinancePayroll}
      />
    );
  });
}
