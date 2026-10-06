"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { leadStageRank } from "@/lib/leadData";
import type { LeadStage } from "@/lib/leadData";

// Phase 1 Sales Scope — "every time the lead status is changed a popup
// box is to come up prompting the consultant to fill out the
// information." The note becomes part of the timeline event itself, so
// "drill down on the lead" (the activity timeline, already built) is
// exactly where that captured information shows up later.
export function StageChangeModal({
  leadName,
  fromStage,
  toStage,
  currentNextAction,
  onClose,
  onConfirm,
}: {
  leadName: string;
  fromStage: LeadStage;
  toStage: LeadStage;
  currentNextAction: string;
  onClose: () => void;
  onConfirm: (note: string, nextAction: string, nextActionDueAt: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState(currentNextAction === "—" ? "" : currentNextAction);
  const [nextActionDueAt, setNextActionDueAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTerminal = (leadStageRank[toStage] ?? 0) < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(note.trim(), nextAction.trim(), nextActionDueAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stage");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Confirm stage change</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-500">
          {leadName}: <span className="text-ink-300">{fromStage}</span> →{" "}
          <span className="text-ink-50">{toStage}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-300">
              {isTerminal ? "Reason (required)" : "What's the update? (required)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              rows={3}
              placeholder={
                isTerminal
                  ? "Why is this lead moving to a closed status?"
                  : "What happened, or what's changed?"
              }
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
          </div>

          {!isTerminal && (
            <>
              <div>
                <label className="mb-1 block text-xs text-ink-300">Next action (optional)</label>
                <input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Follow up call"
                  className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-300">Due (optional)</label>
                <input
                  type="datetime-local"
                  value={nextActionDueAt}
                  onChange={(e) => setNextActionDueAt(e.target.value)}
                  className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-base-700 py-2 text-xs text-ink-300 hover:text-ink-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !note.trim()}
              className="flex-1 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
