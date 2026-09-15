"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, User, Briefcase, FileText, CheckSquare, Users } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import type { Opportunity } from "@/lib/pipelineData";
import type { SphaeraDocument } from "@/lib/documentsData";

type TaskResult = { id: string; title: string; relatedTo: string | null; completed: boolean };
type UserResult = { id: string; name: string; role: string };

type SearchResult = {
  id: string;
  type: "Lead" | "Opportunity" | "Document" | "Task" | "Person";
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
  const [allDocuments, setAllDocuments] = useState<SphaeraDocument[]>([]);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);

  // Documents have no search-by-name API param (the list is small
  // metadata, not worth debouncing per keystroke like Leads/Opportunities)
  // so the full list is fetched once and filtered client-side below.
  useEffect(() => {
    fetch("/api/documents")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ id: string; name: string; docType: string; relatedTo: string | null }>) =>
        setAllDocuments(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.docType as SphaeraDocument["type"],
            relatedTo: r.relatedTo ?? "—",
            uploadedDate: "",
            uploadedBy: "",
            sizeLabel: "",
          }))
        )
      )
      .catch(() => {});
  }, []);

  // Leads and Opportunities are searched against the real database.
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

      fetch(`/api/tasks?search=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: TaskResult[]) => setTaskResults(data))
        .catch(() => {});

      // Manager/Admin only — /api/users/search returns [] for Agents.
      fetch(`/api/users/search?search=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: UserResult[]) => setUserResults(data))
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

    const docResults: SearchResult[] = allDocuments
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

    const tasks: SearchResult[] = taskResults.map((t) => ({
      id: t.id,
      type: "Task",
      title: t.title,
      subtitle: t.completed ? "Completed" : t.relatedTo || "No linked record",
      href: "/tasks",
    }));

    const people: SearchResult[] = userResults.map((u) => ({
      id: u.id,
      type: "Person",
      title: u.name,
      subtitle: u.role,
      href: "/people",
    }));

    return [...leads, ...opportunities, ...docResults, ...tasks, ...people];
  }, [query, leadResults, opportunityResults, allDocuments, taskResults, userResults]);

  const iconFor = {
    Lead: User,
    Opportunity: Briefcase,
    Document: FileText,
    Task: CheckSquare,
    Person: Users,
  };

  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Search</h1>

      <div className="flex max-w-xl items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-4 py-3">
        <SearchIcon className="h-4 w-4 text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads, opportunities, tasks, documents, people…"
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