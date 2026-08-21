"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/leadData";

export function JanusSummaryCard({ lead }: { lead: Lead }) {
  const [isAsking, setIsAsking] = useState(false);

  // Placeholder summary composed from fields already on the lead — this is
  // NOT a real Janus call. Once the Janus Ask/Explain endpoint (Azure AI
  // Foundry + Azure AI Search RAG, per the build spec Section 7) exists,
  // replace this with a real grounded summary and cite its data period.
  const placeholderSummary = `${lead.name} is currently at the ${lead.stage} stage with a ${lead.priority.toLowerCase()} priority score of ${lead.score}. ${lead.prioritizationReason}.`;

  async function handleAskJanus() {
    setIsAsking(true);
    try {
      // TODO: POST to /api/janus/ask with { leadId: lead.id, question: "Summarise this lead" }
      await new Promise((resolve) => setTimeout(resolve, 700));
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="rounded-xl border border-base-700 bg-gradient-to-br from-base-900 to-base-800 p-4">
      <div className="mb-3 flex items-center gap-2">
        <JanusGlyph />
        <h3 className="text-sm font-medium text-ink-50">Janus summary</h3>
      </div>

      <p className="text-xs leading-relaxed text-ink-300">
        {placeholderSummary}
      </p>

      {lead.nextActionDue === "Overdue" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-inactive/30 bg-status-inactive/10 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-inactive" />
          <p className="text-[11px] text-status-inactive">
            This lead's next action is overdue — speed-to-lead window has
            passed.
          </p>
        </div>
      )}

      <button
        onClick={handleAskJanus}
        disabled={isAsking}
        className="mt-3 w-full rounded-lg border border-base-600 bg-base-800 py-2 text-xs font-medium text-ink-50 transition hover:bg-base-700 disabled:opacity-60"
      >
        {isAsking ? "Asking Janus…" : "Ask Janus about this lead"}
      </button>

      <p className="mt-2 text-[10px] text-ink-500">
        Placeholder summary — not yet grounded in live data.
      </p>
    </div>
  );
}

function JanusGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-4 w-4 text-ink-50">
      <path
        d="M14 10c8 0 8 6 16 6s8-6 16-6M14 24c8 0 8 6 16 6s8-6 16-6M14 38c8 0 8 6 16 6s8-6 16-6"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
