"use client";

import { useEffect, useState } from "react";
import { Tag, Check, X } from "lucide-react";

type RemovalRequest = {
  id: string;
  tag: string;
  leadId: string;
  leadName: string;
  reason: string;
  requestedByName: string;
  createdAt: string;
};

export function TagRemovalRequestsCard() {
  const [requests, setRequests] = useState<RemovalRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/tag-removal-requests")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, []);

  async function handleResolve(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tag-removal-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to resolve request");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Tag className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">Tag Removal Requests</h2>
      </div>
      <p className="mb-3 text-[11px] text-ink-500">
        Removing an Interest Tag requires a reason and Admin approval —
        the tag stays on the lead until you resolve the request here.
      </p>

      {error && <p className="mb-3 text-xs text-status-inactive">{error}</p>}
      {requests === null && <p className="text-xs text-ink-500">Loading…</p>}
      {requests && requests.length === 0 && (
        <p className="text-xs text-ink-500">No pending removal requests.</p>
      )}

      <div className="space-y-2">
        {requests?.map((r) => (
          <div key={r.id} className="rounded-lg border border-base-700 bg-base-800 p-3 text-xs">
            <div className="mb-1.5 flex items-center justify-between">
              <a href={`/leads/${r.leadId}`} className="font-medium text-ink-50 hover:underline">
                {r.leadName}
              </a>
              <span className="rounded-full border border-base-700 px-2 py-0.5 text-[10px] text-ink-300">{r.tag}</span>
            </div>
            <p className="text-ink-300">
              <span className="text-ink-500">{r.requestedByName} says:</span> {r.reason}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => handleResolve(r.id, "approve")}
                disabled={busyId === r.id}
                className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-300 hover:border-status-active/40 hover:text-status-active disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                Approve removal
              </button>
              <button
                onClick={() => handleResolve(r.id, "deny")}
                disabled={busyId === r.id}
                className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-500 hover:text-ink-300 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
