import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { listRecentFinanceImports } from "@/lib/finance/ledgerData";
import { UploadNewMonthsPage } from "@/components/finance/UploadNewMonthsPage";

export const dynamic = "force-dynamic";

// Ledger-XLSX-import parsing itself still has no backend (see the two
// stub routes this screen calls), but the import-history table is real:
// FinanceImport has no writers yet, so this honestly renders empty until
// that backend lands, rather than hardcoding an empty array client-side.
export default async function FinanceUploadRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const importHistory = await listRecentFinanceImports();
    return <UploadNewMonthsPage importHistory={importHistory} />;
  });
}
