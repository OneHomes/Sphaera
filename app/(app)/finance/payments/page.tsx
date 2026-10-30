import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { PaymentsView } from "@/components/finance/FinanceViews";

export const dynamic = "force-dynamic";

export default async function FinancePaymentsRoute({
  searchParams,
}: {
  searchParams: { department?: string; month?: string; mode?: string; costHead?: string; description?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    return (
      <PaymentsView
        initialDepartmentFilter={searchParams.department ?? null}
        initialMonthFilter={searchParams.month ?? null}
        initialMode={searchParams.mode ?? null}
        initialCostHeadFilter={searchParams.costHead ?? null}
        initialDescriptionFilter={searchParams.description ?? null}
      />
    );
  });
}
