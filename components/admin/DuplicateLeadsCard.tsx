"use client";

import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";

type FlagLead = { id: string; name: string; contact: string; source: string; stage: string; createdAt: string };
type Flag = {
  id: string;
  matchReason: string;
  lead: FlagLead;
  duplicateOf: FlagLead;
};

export function DuplicateLeadsCard() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/duplicate-leads")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFlags)
      .catch(() => setFlags([]));
  }

  useEffect(load, []);

  async function handleMerge(flagId: string, primaryLeadId: string) {
    setBusyId(flagId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/duplicate-leads/${flagId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", primaryLeadId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to merge");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(flagId: string) {
    setBusyId(flagId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/duplicate-leads/${flagId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to dismiss");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Copy className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">Possible Duplicate Leads</h2>
      </div>
      <p className="mb-3 text-[11px] text-ink-500">
        Detected by matching contact info or name across manually created and synced leads. Merging moves
        all notes, timeline, tags, and opportunities onto whichever record you keep.
      </p>

      {error && <p className="mb-3 text-xs text-status-inactive">{error}</p>}

      {flags === null && <p className="text-xs text-ink-500">Loading…</p>}
      {flags && flags.length === 0 && (
        <p className="text-xs text-ink-500">No pending duplicate flags.</p>
      )}

      <div className="space-y-2">
        {flags?.map((flag) => (
          <div key={flag.id} className="rounded-lg border border-base-700 bg-base-800 p-3 text-xs">
            <p className="mb-2 text-[10px] text-status-alert">{flag.matchReason}</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              {[flag.lead, flag.duplicateOf].map((l) => (
                <div key={l.id} className="rounded-md border border-base-700 bg-base-900 p-2">
                  <p className="text-ink-50">{l.name}</p>
                  <p className="text-ink-500">
                    {l.contact} · {l.source} · {l.stage}
                  </p>
                  <button
                    onClick={() => handleMerge(flag.id, l.id)}
                    disabled={busyId === flag.id}
                    className="mt-1.5 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-300 hover:border-status-active/40 hover:text-status-active disabled:opacity-50"
                  >
                    Keep this one
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleDismiss(flag.id)}
              disabled={busyId === flag.id}
              className="flex items-center gap-1 text-[10px] text-ink-500 hover:text-ink-300 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Not a duplicate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
