"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Library, Plus, Trash2 } from "lucide-react";
import { NewPlaybookModal } from "./NewPlaybookModal";

export type Playbook = {
  id: string;
  title: string;
  category: string;
  body: string;
  createdByName: string;
  createdAt: string;
};

export function PlaybooksPage({
  initialPlaybooks,
  canAuthor,
}: {
  initialPlaybooks: Playbook[];
  canAuthor: boolean;
}) {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState(initialPlaybooks);
  const [category, setCategory] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState(initialPlaybooks[0]?.id ?? "");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(playbooks.map((p) => p.category)))],
    [playbooks]
  );
  const filtered = category === "All" ? playbooks : playbooks.filter((p) => p.category === category);
  const selected = playbooks.find((p) => p.id === selectedId);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this playbook?")) return;
    await fetch(`/api/playbooks/${id}`, { method: "DELETE" });
    setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId("");
    router.refresh();
  }

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 border-r border-base-700 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-sm font-semibold text-ink-50">
            <Library className="h-4 w-4" />
            Playbooks
          </h1>
          {canAuthor && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1 rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mb-3 w-full rounded-lg border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-300 outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="space-y-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                selectedId === p.id ? "bg-base-800" : "hover:bg-base-900"
              }`}
            >
              <p className="text-xs font-medium text-ink-50">{p.title}</p>
              <p className="mt-0.5 text-[10px] text-ink-500">{p.category} · {p.createdByName}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-3 text-center text-xs text-ink-500">
              No playbooks yet{canAuthor ? " — add the first one." : "."}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-50">{selected.title}</h2>
                <p className="mt-1 text-xs text-ink-500">
                  {selected.category} · by {selected.createdByName} · {selected.createdAt}
                </p>
              </div>
              {canAuthor && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-base-800 hover:text-status-inactive"
                  aria-label="Delete playbook"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div
              className="text-sm leading-relaxed text-ink-300 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink-50 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-50"
              dangerouslySetInnerHTML={{ __html: selected.body }}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Select a playbook, or create the first one.
          </div>
        )}
      </div>

      {showNew && (
        <NewPlaybookModal
          onClose={() => setShowNew(false)}
          onCreated={(created) => {
            setPlaybooks((prev) => [created, ...prev]);
            setSelectedId(created.id);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
