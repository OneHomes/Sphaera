"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";
import { DisputeModal } from "./DisputeModal";

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function Kpi({
  title,
  value,
  detail,
  color,
}: {
  title: string;
  value: string;
  detail: string;
  color?: "amber";
}) {
  const colorClass = color === "amber" ? "text-status-alert" : "text-ink-50";
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  return status === "Resolved"
    ? "bg-status-active/15 text-status-active"
    : "bg-status-inactive/15 text-status-inactive";
}

export function DisputedChargesPage({ transactions }: { transactions: FinanceLedgerRow[] }) {
  const [rows, setRows] = useState(transactions);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [target, setTarget] = useState<FinanceLedgerRow | null>(null);

  const openRows = useMemo(() => rows.filter((r) => r.dispute && r.dispute.status !== "Resolved"), [rows]);
  const resolvedRows = useMemo(() => rows.filter((r) => r.dispute?.status === "Resolved"), [rows]);
  const valueUnderReview = useMemo(() => openRows.reduce((s, r) => s + r.amount, 0), [openRows]);

  const filtered = includeResolved ? rows : openRows;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Disputed charges</h2>
        <p className="mt-1 text-sm text-ink-500">
          Central review queue for payments to investigate with Finance. A dispute flag does not remove a charge
          from the accounts.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Open and under review"
          value={openRows.length.toLocaleString()}
          detail="To be investigated with Finance"
          color="amber"
        />
        <Kpi title="Value under review" value={usd(valueUnderReview)} detail="USD, including non-operating entries" />
        <Kpi
          title="Resolved investigations"
          value={resolvedRows.length.toLocaleString()}
          detail="Decisions retained for audit"
        />
        <Kpi title="Dispute total" value={rows.length.toLocaleString()} detail="Across all financial years" />
      </div>

      <WidgetCard
        title="Finance investigation queue"
        action={
          <button
            onClick={() => setIncludeResolved((v) => !v)}
            className="rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            {includeResolved ? "Show open only" : "Include resolved"}
          </button>
        }
      >
        <p className="mb-3 text-xs text-ink-500">
          Click any payment to add evidence notes, set a Finance owner or record a resolution.
        </p>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Supplier / charge</th>
                <th className="px-3 py-2">Reason / assigned Finance owner</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60">
                  <td className="whitespace-nowrap px-3 py-2">{t.date ? new Date(t.date).toLocaleDateString() : t.month}</td>
                  <td className="max-w-[260px] px-3 py-2">
                    <div className="truncate font-semibold text-ink-50" title={t.description}>
                      {t.description}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">#{t.id}</div>
                  </td>
                  <td className="max-w-[260px] px-3 py-2">
                    <div className="truncate" title={t.dispute?.reason ?? ""}>
                      {t.dispute?.reason ?? "—"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      Finance: {t.dispute?.financeOwner ?? "Not assigned"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{usd(t.amount)}</td>
                  <td className="px-3 py-2">
                    {t.dispute && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(t.dispute.status)}`}
                      >
                        {t.dispute.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setTarget(t)}
                      className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-300 hover:text-ink-50"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.75} />
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                    No open disputes. Open any payment and select Flag as disputed to add it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      {target && (
        <DisputeModal
          transactionId={target.id}
          description={target.description}
          existing={target.dispute}
          onClose={() => setTarget(null)}
          onSaved={(updated) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === target.id
                  ? {
                      ...r,
                      dispute: { status: updated.status, reason: updated.reason, financeOwner: updated.financeOwner },
                    }
                  : r
              )
            );
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}
