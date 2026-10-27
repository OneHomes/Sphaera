"use client";

import { useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFinanceFilters } from "./FinanceFilterContext";
import { fyOf } from "@/lib/finance/financeFilters";

const fyName = (y: number) => `FY${y}/${String((y + 1) % 100).padStart(2, "0")}`;

// Port of the source weeklyPage(): opens the server-rendered brief and downloads its JSON.
export function WeeklyCeoBriefPage() {
  const { filters } = useFinanceFilters();
  const now = new Date();
  const year =
    filters.fy === "all" ? fyOf(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`) : Number(filters.fy);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/report/weekly?fy=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not build the report");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ceo-weekly-brief-${fyName(year).replace("/", "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Weekly CEO financial brief</h2>
        <p className="mt-1 text-sm text-ink-500">
          Generate a report from transactions and the approved annual plan for {fyName(year)}.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
        Automatic weekly delivery requires an always-running hosted server and company mail integration. This local
        version prepares the report on demand and does not email anyone yet.
      </div>

      <WidgetCard title="Get your weekly report">
        <p className="text-xs text-ink-500">
          Includes classified actual payments, historical debt cleared, unresolved allocations, and approved budgets by
          department. All sourced directly from Sphaera.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/api/finance/report/weekly?fy=${year}&format=html`}
            target="_blank"
            rel="noopener"
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
          >
            Open readable CEO report ↗
          </a>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download report data (JSON)"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}
      </WidgetCard>
    </div>
  );
}
