"use client";

import { useState } from "react";
import { StickyNote, Send } from "lucide-react";
import type { Note } from "@/lib/leadProfileData";

export function NotesSection({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    // TODO: persist to the Note/Activity entity once a backend exists.
    setNotes((prev) => [
      { id: `n-${Date.now()}`, author: "You", timestamp: "Just now", text: draft },
      ...prev,
    ]);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-50">
        <StickyNote className="h-4 w-4 text-ink-300" />
        Notes
      </h2>

      <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this lead…"
          className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500 focus:border-status-active"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 transition hover:bg-white"
        >
          <Send className="h-3 w-3" />
          Add
        </button>
      </form>

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
      </div>
    </div>
  );
}
