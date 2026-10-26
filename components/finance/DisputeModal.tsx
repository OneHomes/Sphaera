"use client";

import { useState } from "react";
import { X } from "lucide-react";

const DISPUTE_STATUSES = ["Open", "Under review", "Resolved"] as const;
type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export function DisputeModal({
  transactionId,
  description,
  existing,
  onClose,
  onSaved,
}: {
  transactionId: string;
  description: string;
  existing?: { status: string; reason: string | null; financeOwner: string | null } | null;
  onClose: () => void;
  onSaved: (updated: { status: string; reason: string | null; financeOwner: string | null }) => void;
}) {
  const [status, setStatus] = useState<DisputeStatus>((existing?.status as DisputeStatus) ?? "Open");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [financeOwner, setFinanceOwner] = useState(existing?.financeOwner ?? "");
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/ledger/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transactionId,
          status,
          reason,
          financeOwner: financeOwner || undefined,
          notes: notes || undefined,
          resolution: resolution || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update dispute");
      }
      onSaved({ status, reason: reason || null, financeOwner: financeOwner || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-ink-50">{existing ? "Update dispute" : "File a dispute"}</h2>
            <p className="mt-0.5 max-w-xs truncate text-[11px] text-ink-500" title={description}>
              {description}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DisputeStatus)}
            className={inputClass}
          >
            {DISPUTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for dispute"
            rows={2}
            className={inputClass}
          />
          <input
            value={financeOwner}
            onChange={(e) => setFinanceOwner(e.target.value)}
            placeholder="Finance owner (optional)"
            className={inputClass}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
            rows={2}
            className={inputClass}
          />
          {status === "Resolved" && (
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Investigation outcome (required to resolve)"
              rows={2}
              className={inputClass}
            />
          )}
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !reason.trim()}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : existing ? "Update dispute" : "File dispute"}
          </button>
        </form>
      </div>
    </div>
  );
}
