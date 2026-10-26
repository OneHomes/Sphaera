"use client";

import { useState } from "react";
import { ClipboardList, Undo2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

export type ChangeHistoryRow = {
  id: string;
  action: string;
  description: string;
  actorEmail: string;
  changedAt: string;
  undoneAt: string | null;
  undoneBy: string | null;
};

export function ChangeHistoryPage({ initialChanges }: { initialChanges: ChangeHistoryRow[] }) {
  const [changes, setChanges] = useState(initialChanges);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  async function handleUndo(id: string) {
    if (pendingId) return;
    setPendingId(id);
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/finance/change-history/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to undo change");
      }
      setChanges((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, undoneAt: new Date().toISOString(), undoneBy: data?.undoneBy ?? "you" }
            : c
        )
      );
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Failed to undo change",
      }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Change History</h1>
          <p className="mt-1 text-sm text-ink-500">
            {changes.length.toLocaleString()} reversible Finance change(s) — most recent first
          </p>
        </div>
      </div>

      <WidgetCard title="Changes" icon={ClipboardList}>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(c.changedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] font-medium text-ink-300">
                      {c.action}
                    </span>
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2" title={c.description}>
                    {c.description}
                  </td>
                  <td className="px-3 py-2">{c.actorEmail}</td>
                  <td className="px-3 py-2">
                    {c.undoneAt ? (
                      <span
                        className="rounded-full bg-status-inactive/15 px-2 py-0.5 text-[11px] font-medium text-status-inactive"
                        title={`Undone by ${c.undoneBy ?? "unknown"}`}
                      >
                        Undone by {c.undoneBy ?? "unknown"} · {new Date(c.undoneAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!c.undoneAt && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleUndo(c.id)}
                          disabled={pendingId === c.id}
                          className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3 w-3" strokeWidth={1.75} />
                          {pendingId === c.id ? "Undoing…" : "Undo"}
                        </button>
                        {rowErrors[c.id] && (
                          <p className="max-w-[200px] text-right text-[11px] text-status-inactive">
                            {rowErrors[c.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {changes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                    No Finance changes recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}
