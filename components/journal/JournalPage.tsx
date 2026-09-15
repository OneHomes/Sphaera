"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Wand2,
  Folder,
  FileText,
  Lock,
  Search,
  Star,
  Trash2,
  Archive,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import {
  journalFolders,
  type JournalFolder,
  type JournalNote,
  type JournalView,
} from "@/lib/journalData";
import { NewNoteModal } from "./NewNoteModal";
import { AiNoteModal } from "./AiNoteModal";
import { RichTextEditor } from "./RichTextEditor";
import { MindStateCheckIn } from "./MindStateCheckIn";

const RECENTS_COUNT = 3;

function isActive(note: JournalNote) {
  return !note.deletedAt && !note.archivedAt;
}

export function JournalPage({
  initialNotes,
}: {
  initialNotes: JournalNote[];
}) {
  const router = useRouter();
  const [view, setView] = useState<JournalView>("Personal");
  const [lastFolder, setLastFolder] = useState<JournalFolder>("Personal");
  const [selectedNoteId, setSelectedNoteId] = useState(
    initialNotes.find(isActive)?.id ?? ""
  );
  const [showNewNote, setShowNewNote] = useState(false);
  const [showAiNote, setShowAiNote] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");

  const recents = useMemo(
    () => initialNotes.filter(isActive).slice(0, RECENTS_COUNT),
    [initialNotes]
  );

  const notesInView = useMemo(() => {
    let list: JournalNote[];
    if (view === "Favorites") list = initialNotes.filter((n) => n.isFavorite && !n.deletedAt);
    else if (view === "Trash") list = initialNotes.filter((n) => n.deletedAt);
    else if (view === "Archived") list = initialNotes.filter((n) => n.archivedAt && !n.deletedAt);
    else if (view === "Recents") list = recents;
    else list = initialNotes.filter((n) => n.folder === view && isActive(n));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialNotes, view, query, recents]);

  const selectedNote = initialNotes.find((n) => n.id === selectedNoteId);

  function selectFolder(folder: JournalFolder) {
    setView(folder);
    setLastFolder(folder);
  }

  function selectNote(note: JournalNote) {
    setSelectedNoteId(note.id);
    if (note.folder !== view) setView(note.folder);
  }

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 overflow-y-auto border-r border-base-700 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-ink-50">Journal</p>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className={`rounded p-1 text-ink-500 hover:text-ink-300 ${showSearch ? "bg-base-800 text-ink-300" : ""}`}
            aria-label="Search notes"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>

        {showSearch && (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="mb-3 w-full rounded-lg border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
        )}

        <div className="mb-4 flex gap-1.5">
          <button
            onClick={() => setShowNewNote(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-[11px] font-medium text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <Plus className="h-3 w-3" />
            New Note
          </button>
          <button
            onClick={() => setShowAiNote(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-status-active/40 bg-status-active/10 px-2 py-1.5 text-[11px] font-medium text-status-active hover:bg-status-active/20"
          >
            <Wand2 className="h-3 w-3" />
            New Note
          </button>
        </div>

        {recents.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 px-1 text-[11px] font-medium text-ink-500">Recents</p>
            {recents.map((note) => (
              <button
                key={note.id}
                onClick={() => selectNote(note)}
                className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left transition ${
                  selectedNoteId === note.id ? "bg-base-800" : "hover:bg-base-900"
                }`}
              >
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-ink-500" />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-ink-50">
                    {note.title}
                  </span>
                  <span className="block truncate text-[10px] text-ink-500">
                    {note.date} · {note.preview}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="mb-1.5 px-1 text-[11px] font-medium text-ink-500">Folders</p>
        {journalFolders.map((folder) => (
          <button
            key={folder}
            onClick={() => selectFolder(folder)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
              view === folder ? "bg-base-800 text-ink-50" : "text-ink-300 hover:bg-base-900"
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            {folder}
          </button>
        ))}

        <p className="mb-1.5 mt-4 px-1 text-[11px] font-medium text-ink-500">More</p>
        <button
          onClick={() => setView("Favorites")}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
            view === "Favorites" ? "bg-base-800 text-ink-50" : "text-ink-300 hover:bg-base-900"
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          Favorites
        </button>
        <button
          onClick={() => setView("Trash")}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
            view === "Trash" ? "bg-base-800 text-ink-50" : "text-ink-300 hover:bg-base-900"
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Trash
        </button>
        <button
          onClick={() => setView("Archived")}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
            view === "Archived" ? "bg-base-800 text-ink-50" : "text-ink-300 hover:bg-base-900"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived Notes
        </button>

        <p className="mb-2 mt-6 flex items-center gap-1 px-1 text-[10px] text-ink-500">
          <Lock className="h-2.5 w-2.5" />
          Private — only you can see these
        </p>

        <MindStateCheckIn />
      </div>

      <div className="w-64 shrink-0 border-r border-base-700">
        <div className="flex items-center justify-between border-b border-base-700 p-3">
          <p className="text-xs font-medium text-ink-50">{view}</p>
          {typeof view === "string" && journalFolders.includes(view as JournalFolder) && (
            <button
              onClick={() => setShowNewNote(true)}
              className="text-ink-500 hover:text-ink-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto">
          {notesInView.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={`w-full border-b border-base-700 p-3 text-left transition ${
                selectedNoteId === note.id ? "bg-base-900" : "hover:bg-base-900"
              }`}
            >
              <p className="flex items-center gap-1 text-xs font-medium text-ink-50">
                {note.isFavorite && <Star className="h-2.5 w-2.5 shrink-0 fill-tier-gold text-tier-gold" />}
                <span className="truncate">{note.title}</span>
              </p>
              <p className="mt-1 text-[11px] text-ink-500">{note.date}</p>
              <p className="mt-1 truncate text-[11px] text-ink-500">
                {note.preview}
              </p>
            </button>
          ))}
          {notesInView.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-500">
              {view === "Trash"
                ? "Trash is empty"
                : view === "Archived"
                  ? "No archived notes"
                  : view === "Favorites"
                    ? "No favorites yet"
                    : "No notes in this folder"}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedNote ? (
          <JournalEditor
            key={selectedNote.id}
            note={selectedNote}
            onSaved={() => router.refresh()}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Select a note, or create a new one
          </div>
        )}
      </div>

      {showNewNote && (
        <NewNoteModal
          defaultFolder={lastFolder}
          onClose={() => setShowNewNote(false)}
          onCreated={() => router.refresh()}
        />
      )}

      {showAiNote && (
        <AiNoteModal
          defaultFolder={lastFolder}
          onClose={() => setShowAiNote(false)}
          onCreated={(newNoteId) => {
            setSelectedNoteId(newNoteId);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function JournalEditor({
  note,
  onSaved,
}: {
  note: JournalNote;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [folder, setFolder] = useState<JournalFolder>(note.folder);
  const [body, setBody] = useState(note.body);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showMenu, setShowMenu] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setStatus("saving");
    const res = await fetch(`/api/journal/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setStatus("saved");
      onSaved();
    } else {
      setStatus("idle");
    }
  }

  async function deleteForever() {
    if (!window.confirm("Permanently delete this note? This can't be undone.")) return;
    await fetch(`/api/journal/${note.id}`, { method: "DELETE" });
    onSaved();
  }

  const inTrash = !!note.deletedAt;
  const isArchived = !!note.archivedAt;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-500">
          <FileText className="h-4 w-4" />
          <select
            value={folder}
            disabled={inTrash}
            onChange={(e) => {
              const value = e.target.value as JournalFolder;
              setFolder(value);
              save({ folder: value });
            }}
            className="rounded bg-transparent text-xs text-status-active outline-none disabled:opacity-50"
          >
            {journalFolders.map((f) => (
              <option key={f} value={f} className="bg-base-900 text-ink-50">
                {f}
              </option>
            ))}
          </select>
          <span className="text-xs">· {note.date}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-500">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="rounded-full p-1.5 text-ink-500 hover:bg-base-800 hover:text-ink-50"
              aria-label="Note actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-base-700 bg-base-900 p-1 shadow-lg">
                {!inTrash && (
                  <>
                    <button
                      onClick={() => {
                        save({ isFavorite: !note.isFavorite });
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-300 hover:bg-base-800 hover:text-ink-50"
                    >
                      <Star className="h-3.5 w-3.5" />
                      {note.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    </button>
                    <button
                      onClick={() => {
                        save({ archived: !isArchived });
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-300 hover:bg-base-800 hover:text-ink-50"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {isArchived ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      onClick={() => {
                        save({ trashed: true });
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-status-inactive hover:bg-base-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Move to Trash
                    </button>
                  </>
                )}
                {inTrash && (
                  <>
                    <button
                      onClick={() => {
                        save({ trashed: false });
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-300 hover:bg-base-800 hover:text-ink-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        deleteForever();
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-status-inactive hover:bg-base-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete forever
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        value={title}
        disabled={inTrash}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== note.title && save({ title: title.trim() })}
        className="mb-4 w-full max-w-2xl bg-transparent text-xl font-semibold text-ink-50 outline-none disabled:opacity-60"
      />

      <RichTextEditor
        value={body}
        onChange={(html) => setBody(html)}
        placeholder="Write your reflection…"
      />

      {!inTrash && (
        <button
          onClick={() => save({ body })}
          className="mt-3 rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs font-medium text-ink-300 hover:bg-base-700 hover:text-ink-50"
        >
          Save
        </button>
      )}
    </div>
  );
}
