"use client";

import { useState } from "react";
import { RotateCcw, ClipboardList, Undo2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useTablePager } from "./TablePager";
import { ListSearch, useListSearch } from "./ShowMore";

export type ChangeHistoryRow = {
  id: string;
  action: string;
  description: string;
  actorEmail: string;
  changedAt: string;
  undoneAt: string | null;
  undoneBy: string | null;
};

export type AuditLogRow = {
  id: string;
  action: string;
  paymentId: string | null;
  actorEmail: string;
  createdAt: string;
};

// Source historyName labels.
const HISTORY_NAME: Record<string, string> = {
  classify: "Payment classification",
  bulk_management_classify: "Bulk payment allocation",
  dispute_review: "Finance dispute decision",
  update_month: "Monthly management figures",
};
const historyName = (action: string) => {
  const key = action.replace(/^finance_/, "");
  return HISTORY_NAME[key] ?? key;
};
const shortId = (id: string) => id.replace(/^legacy-journal-/, "");

export function ChangeHistoryPage({
  initialChanges,
  auditEntries,
}: {
  initialChanges: ChangeHistoryRow[];
  auditEntries: AuditLogRow[];
}) {
  const [changes, setChanges] = useState(initialChanges);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const changeSearch = useListSearch(changes, (c) => [c.description, historyName(c.action), c.action, c.actorEmail, shortId(c.id)]);
  const auditSearch = useListSearch(auditEntries, (a) => [a.action, a.paymentId, a.actorEmail]);
  const { pageRows: changeRows, pager: changePager } = useTablePager(changeSearch.filtered);
  const { pageRows: auditRows, pager: auditPager } = useTablePager(auditSearch.filtered);

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

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/finance/change-history");
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.changes)) {
          setChanges(data.changes);
        }
      }
    } catch {
      // Best-effort refresh — the table already shows the latest data
      // from the initial page load if this fails.
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Change History &amp; Undo</h2>
        <p className="mt-1 text-sm text-ink-500">
          Review changes, who made them, when they happened, and reverse an eligible action if no later edit has
          affected its records.
        </p>
      </div>

      <WidgetCard
        title="Reversible changes"
        icon={ClipboardList}
        action={
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
            {isRefreshing ? "Refreshing…" : "Refresh history"}
          </button>
        }
      >
        <p className="mb-3 text-xs text-ink-500">
          Payment classifications, bulk payment allocations, dispute decisions and manually edited monthly figures
          are reversible. Undo restores the prior SQL values without touching the imported ledger. An undo is
          permanently recorded in the audit trail.
        </p>
        <div className="mb-2">
          <ListSearch value={changeSearch.query} onChange={changeSearch.setQuery} placeholder="Search changes, actions or users…" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Date &amp; time</th>
                <th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Made by</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {changeRows.map((c) => (
                <tr key={c.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(c.changedAt).toLocaleString()}</td>
                  <td className="max-w-[320px] px-3 py-2">
                    <div className="truncate text-ink-50" title={c.description}>
                      {c.description}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      {historyName(c.action)} · #{shortId(c.id)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{c.actorEmail}</td>
                  <td className="px-3 py-2">
                    {c.undoneAt ? (
                      <span
                        className="rounded-full bg-status-inactive/15 px-2 py-0.5 text-[11px] font-medium text-status-inactive"
                        title={`Undone by ${c.undoneBy ?? "unknown"}`}
                      >
                        Undone {new Date(c.undoneAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.undoneAt ? (
                      <span className="text-[11px] text-ink-500">Already undone</span>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => handleUndo(c.id)}
                          disabled={pendingId === c.id}
                          className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3 w-3" strokeWidth={1.75} />
                          {pendingId === c.id ? "Undoing…" : "Undo"}
                        </button>
                        {rowErrors[c.id] && (
                          <p className="max-w-[200px] text-[11px] text-status-inactive">{rowErrors[c.id]}</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {changes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                    No reversible changes recorded yet. Changes made before this version remain in the original
                    audit history below.
                  </td>
                </tr>
              )}
              {changes.length > 0 && changeSearch.filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                    No changes match &ldquo;{changeSearch.query}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {changePager}
        </div>
      </WidgetCard>

      <div className="mt-4">
        <WidgetCard title="Full accounting audit trail" icon={ClipboardList}>
          <p className="mb-3 text-xs text-ink-500">
            Other operations, including previous-version changes, ERP links, approved plans, head merges and
            invoice actions, remain visible for audit. They cannot be undone automatically because reversal could
            break financial or linked records. Use an approved corrective action with Finance.
          </p>
          <div className="mb-2">
            <ListSearch value={auditSearch.query} onChange={auditSearch.setQuery} placeholder="Search actions, payment IDs or users…" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date &amp; time</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Payment ID</th>
                  <th className="px-3 py-2">Undo</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((a) => (
                  <tr key={a.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-ink-50">{a.action}</td>
                    <td className="px-3 py-2">{a.paymentId ?? "General"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-500">
                        Audit only
                      </span>
                    </td>
                  </tr>
                ))}
                {auditEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No older audit entries.
                    </td>
                  </tr>
                )}
                {auditEntries.length > 0 && auditSearch.filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No audit entries match &ldquo;{auditSearch.query}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {auditPager}
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
