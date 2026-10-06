"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create project");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">New Project</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-ink-50 outline-none placeholder:text-ink-500"
          />
          {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="mt-4 w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Create project"}
          </button>
        </form>
      </div>
    </div>
  );
}
