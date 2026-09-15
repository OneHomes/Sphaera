"use client";

import { useEffect, useState } from "react";
import { X, Loader2, RotateCcw, Send } from "lucide-react";

export function ComposeMessageModal({
  leadId,
  objective,
  onClose,
  onSent,
}: {
  leadId: string;
  objective?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [isDrafting, setIsDrafting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDraft() {
    setIsDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/janus/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, objective }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Janus couldn't draft this message.");
      }
      const data = await res.json();
      setDraft(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDrafting(false);
    }
  }

  useEffect(() => {
    fetchDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogAsSent() {
    if (!draft.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", summary: draft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to log this message");
      }
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Draft with Janus</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isDrafting ? (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Janus is drafting…
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs leading-relaxed text-ink-50 outline-none"
            />
            <p className="mt-2 text-[10px] text-ink-500">
              Review and edit before sending — Janus never sends on its own.
            </p>
          </>
        )}

        {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={fetchDraft}
            disabled={isDrafting}
            className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Regenerate
          </button>
          <button
            onClick={handleLogAsSent}
            disabled={isDrafting || isSending || !draft.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Logging…" : "Log as sent"}
          </button>
        </div>
      </div>
    </div>
  );
}
