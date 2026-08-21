"use client";

import { Search, X } from "lucide-react";
import type { LeadPriority, LeadStage } from "@/lib/leadData";
import { leadSources, leadStages, leadPriorities } from "@/lib/leadData";

export type LeadFilters = {
  search: string;
  priority: LeadPriority | "All";
  stage: LeadStage | "All";
  source: string | "All";
};

export function LeadFilterBar({
  filters,
  onChange,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
}) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.priority !== "All" ||
    filters.stage !== "All" ||
    filters.source !== "All";

  function reset() {
    onChange({ search: "", priority: "All", stage: "All", source: "All" });
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
