"use client";

import { useState } from "react";
import { StickyNote, Send } from "lucide-react";
import type { Note } from "@/lib/leadProfileData";

export function NotesSection({
  leadId,
  initialNotes,
}: {
  leadId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || isSubmitting) return;
    setError(null);

    const text = draft.trim();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save note");
      }

      const savedNote: Note = await res.json();
      setNotes((prev) => [savedNote, ...prev]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save note");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-50">
        <StickyNote className="h-4 w-4 text-ink-300" />
        Notes
      </h2>

      <form onSubmit={handleAddNote} className="mb-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this lead… (@Name to notify a teammate)"
          className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500 focus:border-status-active"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 transition hover:bg-white disabled:opacity-60"
        >
          <Send className="h-3 w-3" />
          {isSubmitting ? "Adding…" : "Add"}
        </button>
      </form>

      {error && <p className="mb-3 text-xs text-status-inactive">{error}</p>}

      <div className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-lg border border-base-700 bg-base-800 p-3"
          >
            <p className="text-xs text-ink-300">{note.text}</p>
            <p className="mt-1.5 text-[11px] text-ink-500">
              {note.author} · {note.timestamp}
            </p>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-center text-xs text-ink-500">
            No notes yet — add the first one above.
          </p>
        )}
      </div>
    </div>
  );
}