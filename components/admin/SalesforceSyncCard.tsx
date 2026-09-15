"use client";

import { useState } from "react";
import { RefreshCw, Cloud } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type SyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  createdLeadNames: string[];
};

export function SalesforceSyncCard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/salesforce-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">Salesforce Sync</h2>
      </div>
      <p className="mb-3 text-[11px] text-ink-500">
        Pulls new leads from Salesforce into Sphaera. Already-synced leads
        only get contact/source details refreshed — stage, priority, and
        assignment are never overwritten, so this can&apos;t undo work
        your team has done inside Sphaera.
      </p>

      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Syncing…" : "Sync now"}
      </button>

      {error && <p className="mt-3 text-xs text-status-inactive">{error}</p>}

      {result && (
        <div className="mt-3 rounded-lg border border-base-700 bg-base-800 p-3 text-xs text-ink-300">
          <p>
            Fetched {result.fetched} from Salesforce — created{" "}
            <span className="text-status-active">{result.created}</span> new,
            refreshed {result.updated}, {result.unchanged} unchanged.
          </p>
          {result.createdLeadNames.length > 0 && (
            <p className="mt-1.5 text-ink-500">
              New: {result.createdLeadNames.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
