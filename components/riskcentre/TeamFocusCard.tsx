"use client";

import { useEffect, useState } from "react";
import { Target, Loader2, Sparkles } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type FocusRow = {
  id: string;
  dimension: string;
  value: string;
  reason: string;
  setByName: string;
  endsAt: string;
};

type Proposal = {
  understood: boolean;
  dimension: "market" | "projectInterest" | "source" | null;
  value: string | null;
  durationDays: number;
  reason: string;
};

const dimensionLabel: Record<string, string> = {
  market: "Market",
  projectInterest: "Project",
  source: "Source",
};

// PRD JN12 — "Janus, shift the team's focus to X." Two explicit steps:
// propose (Janus parses, nothing changes yet) then confirm (a real
// TeamFocus row is created). Never auto-applies from the instruction.
export function TeamFocusCard() {
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isProposing, setIsProposing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/focus")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFocuses)
      .catch(() => {});
  }

  useEffect(load, []);

  async function propose() {
    if (!instruction.trim() || isProposing) return;
    setIsProposing(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/janus/focus-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't parse that instruction.");
      }
      setProposal(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsProposing(false);
    }
  }

  async function confirm() {
    if (!proposal?.understood || isConfirming) return;
    setIsConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension: proposal.dimension,
          value: proposal.value,
          reason: proposal.reason,
          durationDays: proposal.durationDays,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't apply this focus.");
      }
      setProposal(null);
      setInstruction("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <WidgetCard title="Team Focus" icon={Target}>
      {focuses.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {focuses.map((f) => (
            <div key={f.id} className="rounded-lg border border-base-700 bg-base-800 p-2 text-xs">
              <p className="text-ink-50">
                {dimensionLabel[f.dimension] ?? f.dimension}: <span className="font-medium">{f.value}</span>
              </p>
              <p className="text-[10px] text-ink-500">
                {f.reason} · set by {f.setByName} · until {new Date(f.endsAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {proposal ? (
        <div className="rounded-lg border border-base-700 bg-base-800 p-2.5 text-xs">
          {proposal.understood ? (
            <>
              <p className="text-ink-50">
                Shift focus to {dimensionLabel[proposal.dimension ?? ""] ?? proposal.dimension}:{" "}
                <span className="font-medium">{proposal.value}</span> for {proposal.durationDays} day(s)
              </p>
              <p className="mt-1 text-ink-300">{proposal.reason}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={confirm}
                  disabled={isConfirming}
                  className="rounded-md bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-base-950 hover:bg-white disabled:opacity-60"
                >
                  {isConfirming ? "Confirming…" : "Confirm"}
                </button>
                <button
                  onClick={() => setProposal(null)}
                  className="rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-ink-300">{proposal.reason}</p>
              <button
                onClick={() => setProposal(null)}
                className="mt-2 rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
              >
                Try a different instruction
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Janus, shift focus to Diyar leads this week…"
            className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <button
            onClick={propose}
            disabled={isProposing}
            className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isProposing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Propose
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}
    </WidgetCard>
  );
}
