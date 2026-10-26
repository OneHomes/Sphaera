import { UploadNewMonthsPage } from "@/components/finance/UploadNewMonthsPage";

export const dynamic = "force-dynamic";

// No server-side data fetch here: this screen has no backend import logic
// yet (see lib/finance's lack of a ledger-XLSX-import module and the two
// stub routes this page calls). Finance access is already gated by
// app/(app)/finance/layout.tsx for the whole /finance/** tree.
export default function FinanceUploadRoute() {
  return <UploadNewMonthsPage />;
}
