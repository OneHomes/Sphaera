"use client";

import { useState } from "react";
import { RefreshCw, Cloud, History } from "lucide-react";

type SyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  createdLeadNames: string[];
};

type ActivitySyncResult = {
  perType: Record<string, { found: number; imported: number; failed: boolean }>;
  totalImported: number;
};

export function HubSpotSyncCard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSyncingActivity, setIsSyncingActivity] = useState(false);
  const [activityResult, setActivityResult] = useState<ActivitySyncResult | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/hubspot-sync", {
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

  async function handleActivitySync() {
    setIsSyncingActivity(true);
    setActivityError(null);
    setActivityResult(null);
    try {
      const res = await fetch("/api/admin/hubspot-activity-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadLimit: 2500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Activity sync failed");
      setActivityResult(data);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Activity sync failed");
    } finally {
      setIsSyncingActivity(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">HubSpot Sync</h2>
      </div>
      <p className="mb-3 text-[11px] text-ink-500">
        Pulls new leads from HubSpot into Sphaera. Already-synced leads only
        get contact/source/project details refreshed, and only where
        HubSpot actually has a value — stage, priority, assignment, and any
        field HubSpot leaves blank are never overwritten, so this
        can&apos;t undo work your team has done inside Sphaera or wipe
        better existing data.
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
            Fetched {result.fetched} from HubSpot — created{" "}
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

      <div className="mt-4 border-t border-base-700 pt-4">
        <p className="mb-3 text-[11px] text-ink-500">
          Pulls full call/email/meeting/note/task history from HubSpot into
          each lead&apos;s activity timeline, alongside anything already
          logged inside Sphaera. Safe to re-run — already-imported
          engagements are never duplicated.
        </p>
        <button
          onClick={handleActivitySync}
          disabled={isSyncingActivity}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs font-semibold text-ink-50 hover:border-base-600 disabled:opacity-60"
        >
          <History className={`h-3.5 w-3.5 ${isSyncingActivity ? "animate-spin" : ""}`} />
          {isSyncingActivity ? "Importing activity…" : "Sync activity history"}
        </button>

        {activityError && <p className="mt-3 text-xs text-status-inactive">{activityError}</p>}

        {activityResult && (
          <div className="mt-3 rounded-lg border border-base-700 bg-base-800 p-3 text-xs text-ink-300">
            <p>
              Imported <span className="text-status-active">{activityResult.totalImported}</span> activity events.
            </p>
            <ul className="mt-1.5 space-y-0.5 text-ink-500">
              {Object.entries(activityResult.perType).map(([type, r]) => (
                <li key={type}>
                  {type}: {r.imported} imported ({r.found} found){r.failed ? " — failed, check scope" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
