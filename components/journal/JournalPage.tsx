"use client";

import { useState } from "react";
import { Plus, Folder, FileText } from "lucide-react";
import {
  journalFolders,
  journalNotes,
  type JournalFolder,
  type JournalNote,
} from "@/lib/journalData";

export function JournalPage() {
  const [activeFolder, setActiveFolder] = useState<JournalFolder>("Work");
  const [selectedNoteId, setSelectedNoteId] = useState(
    journalNotes[0]?.id ?? ""
  );

  const notesInFolder = journalNotes.filter((n) => n.folder === activeFolder);
  const selectedNote = journalNotes.find((n) => n.id === selectedNoteId);

  return (
    <div className="flex h-full">
      <div className="w-40 shrink-0 border-r border-base-700 p-3">
        <p className="mb-2 px-1 text-[11px] font-medium text-ink-500">
          Folders
        </p>
        {journalFolders.map((folder) => (
          <button
            key={folder}
            onClick={() => setActiveFolder(folder)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
              activeFolder === folder
                ? "bg-base-800 text-ink-50"
                : "text-ink-300 hover:bg-base-900"
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            {folder}
          </button>
        ))}
      </div>

      <div className="w-64 shrink-0 border-r border-base-700">
        <div className="flex items-center justify-between border-b border-base-700 p-3">
          <p className="text-xs font-medium text-ink-50">{activeFolder}</p>
          <button className="text-ink-500 hover:text-ink-300">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {notesInFolder.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={`w-full border-b border-base-700 p-3 text-left transition ${
                selectedNoteId === note.id ? "bg-base-900" : "hover:bg-base-900"
              }`}
            >
              <p className="text-xs font-medium text-ink-50">{note.title}</p>
              <p className="mt-1 text-[11px] text-ink-500">{note.date}</p>
              <p className="mt-1 truncate text-[11px] text-ink-500">
                {note.preview}
              </p>
            </button>
          ))}
          {notesInFolder.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-500">
              No notes in this folder
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedNote ? (
          <JournalEditor note={selectedNote} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Select a note
          </div>
        )}
      </div>
    </div>
  );
}

function JournalEditor({ note }: { note: JournalNote }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-ink-500">
        <FileText className="h-4 w-4" />
        <span className="text-xs">
          {note.folder} · {note.date}
        </span>
      </div>
      <h1 className="mb-4 text-xl font-semibold text-ink-50">{note.title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-300">
        {note.body}
      </p>
    </div>
  );
}
