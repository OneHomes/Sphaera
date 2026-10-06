"use client";

import { useEffect, useState } from "react";
import { Tag, X, Plus } from "lucide-react";

type LeadTagRow = { id: string; tag: string; addedByName: string; createdAt: string };

export function LeadTagsCard({ leadId }: { leadId: string }) {
  const [tags, setTags] = useState<LeadTagRow[]>([]);
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/leads/${leadId}/tags`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setTags)
      .catch(() => {});
  }

  useEffect(load, [leadId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isAdding) return;
    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: input }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add tag");
      }
      setInput("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(tagId: string) {
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/tags/${tagId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to remove tag");
      return;
    }
    load();
  }

  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-50">
        <Tag className="h-4 w-4 text-ink-300" />
        Interest Tags
      </h3>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            title={`Added by ${t.addedByName}`}
            className="flex items-center gap-1 rounded-full border border-base-700 bg-base-800 px-2 py-0.5 text-xs text-ink-300"
          >
            {t.tag}
            <button onClick={() => handleRemove(t.id)} className="text-ink-600 hover:text-status-inactive">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <p className="text-xs text-ink-500">No tags yet.</p>}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="#MountainViews"
          className="flex-1 rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          disabled={isAdding || !input.trim()}
          className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}
    </div>
  );
}
