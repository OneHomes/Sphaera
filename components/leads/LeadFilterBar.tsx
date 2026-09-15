"use client";

import { Search, X } from "lucide-react";
import type { LeadPriority, LeadStage } from "@/lib/leadData";
import { leadSources, leadStages, leadPriorities } from "@/lib/leadData";

export type ScoreBand = "Hot" | "Warm" | "Cool";

export type LeadFilters = {
  search: string;
  priority: LeadPriority | "All";
  stage: LeadStage | "All";
  source: string | "All";
  market: string | "All";
  project: string | "All";
  scoreBand: ScoreBand | "All";
  overdueOnly: boolean;
};

export const defaultLeadFilters: LeadFilters = {
  search: "",
  priority: "All",
  stage: "All",
  source: "All",
  market: "All",
  project: "All",
  scoreBand: "All",
  overdueOnly: false,
};

export function LeadFilterBar({
  filters,
  onChange,
  markets,
  projects,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  markets: string[];
  projects: string[];
}) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.priority !== "All" ||
    filters.stage !== "All" ||
    filters.source !== "All" ||
    filters.market !== "All" ||
    filters.project !== "All" ||
    filters.scoreBand !== "All" ||
    filters.overdueOnly;

  function reset() {
    onChange(defaultLeadFilters);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-base-700 bg-base-950 px-6 py-3">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-500" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search leads by name…"
          className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
        />
      </div>

      <select
        value={filters.priority}
        onChange={(e) =>
          onChange({ ...filters, priority: e.target.value as LeadPriority | "All" })
        }
        className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All priorities</option>
        {leadPriorities.map((p) => (
          <option key={p} value={p}>
            {p} priority
          </option>
        ))}
      </select>

      <select
        value={filters.stage}
        onChange={(e) =>
          onChange({ ...filters, stage: e.target.value as LeadStage | "All" })
        }
        className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All stages</option>
        {leadStages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={filters.source}
        onChange={(e) => onChange({ ...filters, source: e.target.value })}
        className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All sources</option>
        {leadSources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={filters.market}
        onChange={(e) => onChange({ ...filters, market: e.target.value })}
        className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All markets</option>
        {markets.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        value={filters.project}
        onChange={(e) => onChange({ ...filters, project: e.target.value })}
        className="max-w-[160px] rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All projects</option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        value={filters.scoreBand}
        onChange={(e) =>
          onChange({ ...filters, scoreBand: e.target.value as ScoreBand | "All" })
        }
        className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 outline-none"
      >
        <option value="All">All score bands</option>
        <option value="Hot">Hot</option>
        <option value="Warm">Warm</option>
        <option value="Cool">Cool</option>
      </select>

      <label className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300">
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(e) => onChange({ ...filters, overdueOnly: e.target.checked })}
          className="accent-status-active"
        />
        Overdue only
      </label>

      {hasActiveFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-ink-500 hover:text-ink-300"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
