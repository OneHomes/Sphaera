"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

export function AddTaskModal({
  onClose,
  defaultTitle = "",
  defaultRelatedTo = "",
  leadId,
  source,
  heading = "Add task",
  onCreated,
}: {
  onClose: () => void;
  defaultTitle?: string;
  defaultRelatedTo?: string;
  leadId?: string;
  source?: "Janus proposed";
  heading?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [relatedTo, setRelatedTo] = useState(defaultRelatedTo);
  const [dueDate, setDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          relatedTo: relatedTo || undefined,
          leadId: leadId || undefined,
          source,
          dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create task");
      }

      onClose();
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{heading}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={relatedTo}
            onChange={(e) => setRelatedTo(e.target.value)}
            placeholder="Related to (optional)"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {isSaving ? "Adding…" : "Add task"}
          </button>
        </form>
      </div>
    </div>
  );
}