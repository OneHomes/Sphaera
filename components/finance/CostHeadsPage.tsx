"use client";

import { useMemo, useState } from "react";
import { Tags, Search } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type CostHeadRow = { id: string; head: string; centre: string };

export function CostHeadsPage({ costHeads }: { costHeads: CostHeadRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return costHeads;
    return costHeads.filter(
      (c) => c.head.toLowerCase().includes(q) || c.centre.toLowerCase().includes(q)
    );
  }, [costHeads, query]);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Cost Heads</h1>
          <p className="mt-1 text-sm text-ink-500">
            {costHeads.length.toLocaleString()} legacy head / cost-centre pairs imported from source data
          </p>
        </div>
      </div>

      <WidgetCard title="Legacy Head / Centre Pairs" icon={Tags}>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-base-700 bg-base-800 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-ink-500" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by head or centre…"
            className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Head</th>
                <th className="px-3 py-2">Centre</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2 text-ink-50">{c.head}</td>
                  <td className="px-3 py-2">{c.centre}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-ink-500">
                    No cost heads match &quot;{query}&quot;.
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
