"use client";

import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { journalFolders, type JournalFolder } from "@/lib/journalData";

export function AiNoteModal({
  defaultFolder,
  onClose,
  onCreated,
}: {
  defaultFolder: JournalFolder;
  onClose: () => void;
  onCreated: (newNoteId: string) => void;
}) {
  const [folder, setFolder] = useState<JournalFolder>(defaultFolder);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Tell Janus what to write about.");
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/journal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, folder }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to generate note");
      }

      const created = await res.json();
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-50">
            <Sparkles className="h-4 w-4 text-status-active" />
            New note with Janus
          </h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value as JournalFolder)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            {journalFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should this note be about? e.g. “Reflect on how this month went”"
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating ? "Janus is writing…" : "Generate note"}
          </button>
        </form>
      </div>
    </div>
  );
}
