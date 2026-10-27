import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { prisma } from "@/lib/prisma";
import {
  listInvoices,
  listRecurring,
  listCardRules,
  listCardCharges,
  listCardStatements,
  projection,
} from "@/lib/finance/creditCycleData";
import { CreditCyclePage } from "@/components/finance/CreditCyclePage";

export const dynamic = "force-dynamic";

export default async function FinanceCreditCycleRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const [invoices, recurring, forecast, cardRules, cardCharges, statements, paymentSources] = await Promise.all([
      listInvoices(),
      listRecurring(),
      projection({ includePayroll: authUser.canAccessFinancePayroll }),
      listCardRules(),
      listCardCharges(),
      listCardStatements(),
      prisma.financePaymentSource.findMany({
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true, currency: true },
      }),
    ]);

    return (
      <CreditCyclePage
        invoices={invoices}
        recurring={recurring}
        forecast={forecast}
        cardRules={cardRules}
        cardCharges={cardCharges}
        statements={statements}
        paymentSources={paymentSources}
        canAccessFinancePayroll={authUser.canAccessFinancePayroll}
      />
    );
  });
}
