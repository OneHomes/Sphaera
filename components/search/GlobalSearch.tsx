"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, User, Briefcase, FileText } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import type { Opportunity } from "@/lib/pipelineData";
import { documents } from "@/lib/documentsData";

type SearchResult = {
  id: string;
  type: "Lead" | "Opportunity" | "Document";
  title: string;
  subtitle: string;
  href?: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [opportunityResults, setOpportunityResults] = useState<Opportunity[]>(
    []
  );

  // Leads and Opportunities are searched against the real database.
  // Documents are still mock (lib/documentsData.ts) until that module is
  // connected to real storage — see build spec Section 10 for sequencing.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setLeadResults([]);
      setOpportunityResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/leads?search=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Lead[]) => setLeadResults(data))
        .catch(() => {});

      fetch(`/api/opportunities?search=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Opportunity[]) => setOpportunityResults(data))
        .catch(() => {});
    }, 250); // debounce

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const leads: SearchResult[] = leadResults.map((l) => ({
      id: l.id,
      type: "Lead",
      title: l.name,
      subtitle: `${l.stage} · ${l.projectInterest}`,
      href: `/leads/${l.id}`,
    }));

    const opportunities: SearchResult[] = opportunityResults.map((o) => ({
      id: o.id,
      type: "Opportunity",
      title: o.leadName,
      subtitle: `${o.stage} · ${o.projectInterest}`,
      href: "/pipeline",
    }));

    const docResults: SearchResult[] = documents
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.relatedTo.toLowerCase().includes(q)
      )
      .map((d) => ({
        id: d.id,
        type: "Document",
        title: d.name,
        subtitle: d.relatedTo,
        href: "/documents",
      }));

    return [...leads, ...opportunities, ...docResults];
  }, [query, leadResults, opportunityResults]);

  const iconFor = { Lead: User, Opportunity: Briefcase, Document: FileText };

  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Search</h1>

      <div className="flex max-w-xl items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-4 py-3">
        <SearchIcon className="h-4 w-4 text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads, opportunities, documents…"
          className="w-full bg-transparent text-sm text-ink-50 outline-none placeholder:text-ink-500"
          autoFocus
        />
      </div>

      <div className="mt-4 max-w-xl space-y-2">
        {results.map((result) => {
          const Icon = iconFor[result.type];
          return (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => result.href && router.push(result.href)}
              className="flex w-full items-center gap-3 rounded-lg border border-base-700 bg-base-900 p-3 text-left hover:bg-base-800"
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-50">{result.title}</p>
                <p className="truncate text-xs text-ink-500">
                  {result.subtitle}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-500">
                {result.type}
              </span>
            </button>
          );
        })}

        {query.trim() && results.length === 0 && (
          <p className="text-sm text-ink-500">
            No results for &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}