"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Plus, UserPlus, Repeat, Download, ChevronLeft, ChevronRight } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { ApexGlyph } from "@/components/ui/ApexGlyph";
import { LeadFilterBar, defaultLeadFilters, type LeadFilters } from "./LeadFilterBar";
import { AddLeadModal } from "./AddLeadModal";
import {
  PriorityBadge,
  StageBadge,
  ScoreBadge,
  EngagementIndicator,
  AssignmentBadge,
} from "./LeadBadges";

// Filtering, sorting, and pagination all happen server-side now (see
// app/(app)/leads/page.tsx + lib/leadFilterQuery.ts) — `initialLeads` is
// exactly one page of already-filtered rows, not the full table. This
// component just reflects filter/page state into the URL and lets the
// server component re-fetch; it no longer holds or filters the whole
// dataset in the browser. That split is the fix for /leads hanging once
// the Lead table reached ~194,000 rows (was previously one unbounded
// findMany + in-memory filtering).

function filtersToSearchParams(filters: LeadFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.priority !== "All") params.set("priority", filters.priority);
  if (filters.stage !== "All") params.set("stage", filters.stage);
  if (filters.source !== "All") params.set("source", filters.source);
  if (filters.market !== "All") params.set("market", filters.market);
  if (filters.project !== "All") params.set("project", filters.project);
  if (filters.scoreBand !== "All") params.set("scoreBand", filters.scoreBand);
  if (filters.overdueOnly) params.set("overdueOnly", "true");
  if (filters.tag.trim()) params.set("tag", filters.tag.trim());
  return params;
}

export function LeadInbox({
  initialLeads,
  currentUserId,
  isManagementView = false,
  assignableUsers = [],
  canExportData = false,
  markets = [],
  projects = [],
  totalCount,
  page,
  pageSize,
}: {
  initialLeads: Lead[];
  currentUserId: string;
  isManagementView?: boolean;
  assignableUsers?: { id: string; name: string }[];
  canExportData?: boolean;
  markets?: string[];
  projects?: string[];
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pagination/filter clicks call router.push with new searchParams on
  // this same route — wrapping those in a transition gives us `isPending`
  // to show a loading state while the server component re-fetches, since
  // (unlike a full navigation into /leads) a searchParams-only change
  // doesn't reliably surface the route's loading.tsx on its own.
  const [isPending, startTransition] = useTransition();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  // The server component re-runs on every filter/page navigation and
  // hands down a new `initialLeads` page — sync local state (which also
  // carries optimistic assign/reassign edits) to match each time.
  useEffect(() => setLeads(initialLeads), [initialLeads]);

  // PRD JN12 — Mission Centre's "Team Focus" item links here with
  // ?market=/?project=/?source=, so the linked filter is actually applied.
  const filters: LeadFilters = {
    search: searchParams.get("search") ?? defaultLeadFilters.search,
    priority: (searchParams.get("priority") as LeadFilters["priority"]) ?? defaultLeadFilters.priority,
    stage: searchParams.get("stage") ?? defaultLeadFilters.stage,
    source: searchParams.get("source") ?? defaultLeadFilters.source,
    market: searchParams.get("market") ?? defaultLeadFilters.market,
    project: searchParams.get("project") ?? defaultLeadFilters.project,
    scoreBand: (searchParams.get("scoreBand") as LeadFilters["scoreBand"]) ?? defaultLeadFilters.scoreBand,
    overdueOnly: searchParams.get("overdueOnly") === "true",
    tag: searchParams.get("tag") ?? defaultLeadFilters.tag,
  };

  // Free-text fields (search, tag) get a debounce so typing doesn't fire
  // a server round trip on every keystroke; every other filter navigates
  // immediately, same as before.
  const [localText, setLocalText] = useState({ search: filters.search, tag: filters.tag });
  useEffect(() => {
    setLocalText({ search: filters.search, tag: filters.tag });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.tag]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localText.search !== filters.search || localText.tag !== filters.tag) {
        pushFilters({ ...filters, search: localText.search, tag: localText.tag });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localText]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetId, setBulkTargetId] = useState("");
  const [isBulkReassigning, setIsBulkReassigning] = useState(false);

  function pushFilters(next: LeadFilters) {
    const params = filtersToSearchParams(next);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/leads?${qs}` : "/leads");
    });
  }

  function handleFilterChange(next: LeadFilters) {
    const onlyTextChanged =
      next.priority === filters.priority &&
      next.stage === filters.stage &&
      next.source === filters.source &&
      next.market === filters.market &&
      next.project === filters.project &&
      next.scoreBand === filters.scoreBand &&
      next.overdueOnly === filters.overdueOnly;
    if (onlyTextChanged) {
      setLocalText({ search: next.search, tag: next.tag });
      return;
    }
    setLocalText({ search: next.search, tag: next.tag });
    pushFilters(next);
  }

  function goToPage(newPage: number) {
    const params = filtersToSearchParams(filters);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/leads?${qs}` : "/leads");
    });
  }

  const displayFilters: LeadFilters = { ...filters, search: localText.search, tag: localText.tag };
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  function exportCsvUrl(): string {
    const params = filtersToSearchParams(filters);
    params.set("format", "csv");
    return `/api/leads?${params.toString()}`;
  }

  async function handleReassign(leadId: string, newUserId: string, newUserName: string) {
    setReassigningLeadId(null);
    // PRD AE17 — an optional handover note travels with a manager
    // reassignment so the new owner gets real context, not a cold lead.
    const handoverNote = window.prompt(
      `Reassigning to ${newUserName}. Add a handover note (optional):`,
      ""
    );
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, assignedUserId: newUserId, assignedUserName: newUserName, assignment: "Locked" }
          : l
      )
    );
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedUserId: newUserId,
          ...(handoverNote && handoverNote.trim() ? { handoverNote: handoverNote.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to reassign lead");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to reassign lead");
      router.refresh();
    }
  }

  function toggleSelected(leadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = leads.every((l) => prev.has(l.id));
      if (allSelected) return new Set();
      return new Set(leads.map((l) => l.id));
    });
  }

  async function handleBulkReassign() {
    const target = assignableUsers.find((u) => u.id === bulkTargetId);
    if (!target || selectedIds.size === 0 || isBulkReassigning) return;
    const handoverNote = window.prompt(
      `Reassigning ${selectedIds.size} lead(s) to ${target.name}. Add a handover note (optional):`,
      ""
    );
    setIsBulkReassigning(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((leadId) =>
          fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignedUserId: target.id,
              ...(handoverNote && handoverNote.trim() ? { handoverNote: handoverNote.trim() } : {}),
            }),
          }).then((res) => {
            if (!res.ok) throw new Error("Failed");
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        window.alert(`${failed} of ${selectedIds.size} leads couldn't be reassigned (capacity or already claimed).`);
      }
      setSelectedIds(new Set());
      setBulkTargetId("");
      router.refresh();
    } finally {
      setIsBulkReassigning(false);
    }
  }

  async function handleAssignToMe(e: React.MouseEvent, leadId: string) {
    e.stopPropagation(); // don't trigger the row's navigate-to-profile click
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              assignedUserId: currentUserId,
              assignedUserName: "You",
              assignment: "Locked",
            }
          : l
      )
    );

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: currentUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to assign lead");
      }
      router.refresh();
    } catch (err) {
      // PRD R08 (fair allocation): capacity caps and "already claimed"
      // races surface a real, actionable reason here rather than
      // silently reverting.
      window.alert(err instanceof Error ? err.message : "Failed to assign lead");
      router.refresh();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-base-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Lead Inbox</h1>
          <p className="mt-1 text-sm text-ink-500">
            {totalCount.toLocaleString()} lead{totalCount === 1 ? "" : "s"} match these filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExportData && (
            <a
              href={exportCsvUrl()}
              className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add lead
          </button>
        </div>
      </div>

      <LeadFilterBar filters={displayFilters} onChange={handleFilterChange} markets={markets} projects={projects} />

      {isManagementView && selectedIds.size > 0 && assignableUsers.length > 0 && (
        <div className="flex items-center gap-2 border-b border-base-700 bg-base-900 px-6 py-2.5">
          <span className="text-xs text-ink-300">{selectedIds.size} selected</span>
          <select
            value={bulkTargetId}
            onChange={(e) => setBulkTargetId(e.target.value)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-300 outline-none"
          >
            <option value="">Reassign to…</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleBulkReassign}
            disabled={!bulkTargetId || isBulkReassigning}
            className="rounded-lg bg-ink-50 px-3 py-1 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isBulkReassigning ? "Reassigning…" : "Reassign selected"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-ink-500 hover:text-ink-300"
          >
            Clear
          </button>
        </div>
      )}

      <div className="relative flex-1 overflow-auto px-6 py-4">
        {isPending && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-base-950/85 backdrop-blur-sm">
            <ApexGlyph className="h-10 w-10 text-white" />
            <div className="relative h-px w-28 overflow-hidden bg-base-700">
              <span className="absolute top-0 h-px w-[35%] animate-loadingSweep bg-white" />
            </div>
            <p className="text-[10px] tracking-[0.3em] text-ink-500">LOADING LEADS</p>
          </div>
        )}
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              {isManagementView && assignableUsers.length > 0 && (
                <th className="pb-2 pr-2 font-normal">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                    onChange={toggleSelectAllVisible}
                    className="accent-status-active"
                  />
                </th>
              )}
              <th className="pb-2 pr-3 font-normal">Lead</th>
              <th className="pb-2 pr-3 font-normal">Source / Market</th>
              <th className="pb-2 pr-3 font-normal">Interest</th>
              <th className="pb-2 pr-3 font-normal">Stage</th>
              <th className="pb-2 pr-3 font-normal">Score</th>
              <th className="pb-2 pr-3 font-normal">Engagement</th>
              <th className="pb-2 pr-3 font-normal">Priority</th>
              <th className="pb-2 pr-3 font-normal">Last interaction</th>
              <th className="pb-2 pr-3 font-normal">Next action</th>
              <th className="pb-2 font-normal">Assignment</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => router.push(`/leads/${lead.id}`)}
                className="cursor-pointer border-t border-base-700 text-ink-300 transition hover:bg-base-900"
              >
                {isManagementView && assignableUsers.length > 0 && (
                  <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      className="accent-status-active"
                    />
                  </td>
                )}
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-ink-50">{lead.name}</div>
                  <div className="text-ink-500">{lead.contact}</div>
                  {lead.email && lead.email !== lead.contact && (
                    <div className="text-ink-500">{lead.email}</div>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <div>{lead.source}</div>
                  <div className="text-ink-500">{lead.market}</div>
                </td>
                <td className="py-2.5 pr-3 max-w-[160px] truncate" title={lead.projectInterest}>
                  {lead.projectInterest}
                </td>
                <td className="py-2.5 pr-3">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="py-2.5 pr-3">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="py-2.5 pr-3">
                  <EngagementIndicator level={lead.engagement} />
                </td>
                <td className="py-2.5 pr-3">
                  <PriorityBadge priority={lead.priority} />
                </td>
                <td className="py-2.5 pr-3 text-ink-500">
                  {lead.lastInteraction}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span>{lead.nextAction}</span>
                    <span
                      title={lead.prioritizationReason}
                      className="cursor-help text-ink-500"
                    >
                      <Info className="h-3 w-3" />
                    </span>
                  </div>
                  <div
                    className={
                      lead.nextActionDue === "Overdue"
                        ? "text-status-inactive"
                        : "text-ink-500"
                    }
                  >
                    {lead.nextActionDue}
                  </div>
                </td>
                <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                  {lead.assignedUserName ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-ink-300">
                          {lead.assignedUserName}
                        </span>
                        <AssignmentBadge status={lead.assignment} />
                        {isManagementView && assignableUsers.length > 0 && (
                          <button
                            onClick={() =>
                              setReassigningLeadId((id) => (id === lead.id ? null : lead.id))
                            }
                            aria-label="Reassign lead"
                            className="text-ink-500 hover:text-ink-300"
                          >
                            <Repeat className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {lead.assignment === "Locked" && lead.lockedUntilLabel && (
                        <span className="text-[10px] text-status-alert">
                          Locked until {lead.lockedUntilLabel}
                        </span>
                      )}
                      {reassigningLeadId === lead.id && (
                        <select
                          autoFocus
                          defaultValue=""
                          onChange={(e) => {
                            const target = assignableUsers.find((u) => u.id === e.target.value);
                            if (target) handleReassign(lead.id, target.id, target.name);
                          }}
                          className="mt-1 rounded border border-base-700 bg-base-800 px-1.5 py-1 text-[11px] text-ink-300 outline-none"
                        >
                          <option value="" disabled>
                            Reassign to…
                          </option>
                          {assignableUsers
                            .filter((u) => u.id !== lead.assignedUserId)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleAssignToMe(e, lead.id)}
                      className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-300"
                    >
                      <UserPlus className="h-3 w-3" />
                      Assign to me
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="mt-12 text-center text-sm text-ink-500">
            No leads match these filters. Try clearing one and searching
            again.
          </div>
        )}

        {totalCount > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-ink-500">
            <span>
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {totalCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isPending}
                className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isPending}
                className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
