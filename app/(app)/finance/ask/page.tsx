import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { AskYourDataPage } from "@/components/finance/AskYourDataPage";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

// The chat is driven by POST /api/finance/chat (see that route for the Janus grounding). It
// answers from company-wide data, so department-limited users don't get it.
export default async function FinanceAskRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    return <AskYourDataPage />;
  });
}
