import { AskYourDataPage } from "@/components/finance/AskYourDataPage";

export const dynamic = "force-dynamic";

// No tenant-scoped server fetch needed here — the layout already gates
// canAccessFinance, and the chat itself is driven entirely by
// POST /api/finance/chat (see that route for the Janus grounding).
export default function FinanceAskRoute() {
  return <AskYourDataPage />;
}
