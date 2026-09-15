"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { JanusGlyph } from "@/components/janus/JanusGlyph";
import { JanusFeedback } from "@/components/janus/JanusFeedback";

export function JanusSummaryCard({ lead }: { lead: Lead }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAskJanus() {
    setIsAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "leadId",
          leadId: lead.id,
          question:
            "Summarise this lead in 3-4 sentences, including its current stage, engagement level, and any risks or overdue actions I should know about.",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.detail) console.error("Janus ask detail:", data.detail);
        throw new Error(data?.error ?? "Janus request failed");
      }

      const data = await res.json();
      setSummary(data.answer);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't reach Janus right now."
      );
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="rounded-xl border border-base-700 bg-gradient-to-br from-base-900 to-base-800 p-4">
      <div className="mb-3 flex items-center gap-2">
        <JanusGlyph className="h-4 w-4 text-white" />
        <h3 className="text-sm font-medium text-ink-50">Janus summary</h3>
      </div>

      {summary ? (
        <>
          <p className="text-xs leading-relaxed text-ink-300">{summary}</p>
          <div className="mt-2 border-t border-base-700 pt-2">
            <JanusFeedback context={`leadSummary:${lead.id}`} />
          </div>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-ink-500">
          Click below to have Janus summarise this lead using its real
          record — notes, timeline, and current stage.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-status-inactive">{error}</p>
      )}

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
        {isAsking ? "Asking Janus…" : summary ? "Ask again" : "Ask Janus about this lead"}
      </button>
    </div>
  );
}