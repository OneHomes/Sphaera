"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { RichTextEditor } from "@/components/journal/RichTextEditor";
import type { Playbook } from "./PlaybooksPage";

export function NewPlaybookModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (playbook: Playbook) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const plainBody = body.replace(/<[^>]*>/g, "").trim();
    if (!title.trim() || !category.trim() || !plainBody) {
      setError("Title, category, and content are all required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save playbook");
      }
      const created = await res.json();
      onCreated({
        ...created,
        createdAt: new Date(created.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">New playbook</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Objection Handling, Follow-up Scripts)"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <RichTextEditor value={body} onChange={setBody} placeholder="Playbook content…" />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : "Save playbook"}
          </button>
        </form>
      </div>
    </div>
  );
}
