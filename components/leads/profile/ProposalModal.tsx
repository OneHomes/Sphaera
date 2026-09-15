"use client";

import { useEffect, useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { RichTextEditor } from "@/components/journal/RichTextEditor";

export function ProposalModal({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/proposal`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to generate proposal draft");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTitle(data.title);
        setBody(data.body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function handleSave() {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save proposal");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-50">
            <FileText className="h-4 w-4 text-status-active" />
            Generate proposal
          </h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isGenerating ? (
          <div className="flex items-center gap-2 py-10 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Janus is drafting a proposal from this lead's record and reference documents…
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title"
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm font-medium text-ink-50 outline-none placeholder:text-ink-500"
            />
            <RichTextEditor value={body} onChange={setBody} placeholder="Proposal content…" />

            {error && <p className="text-xs text-status-inactive">{error}</p>}

            <p className="text-[10px] text-ink-500">
              Review before saving — Janus can only reference this lead's
              record and your uploaded price lists/payment plans/brochures,
              but you're the one confirming it's accurate to send.
            </p>

            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save to Documents"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
