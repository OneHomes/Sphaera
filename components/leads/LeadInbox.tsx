"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Plus, UserPlus, Repeat, Download } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { scoreBand } from "@/lib/leadData";
import { downloadCsv } from "@/lib/csv";
import { LeadFilterBar, defaultLeadFilters, type LeadFilters } from "./LeadFilterBar";
import { AddLeadModal } from "./AddLeadModal";
import {
  PriorityBadge,
  StageBadge,
  ScoreBadge,
  EngagementIndicator,
  AssignmentBadge,
} from "./LeadBadges";

export function LeadInbox({
  initialLeads,
  currentUserId,
  isManagementView = false,
  assignableUsers = [],
}: {
  initialLeads: Lead[];
  currentUserId: string;
  isManagementView?: boolean;
  assignableUsers?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  // PRD JN12 — Mission Centre's "Team Focus" item links here with
  // ?market=/?project=/?source=, so the linked filter is actually applied
  // rather than just landing on an unfiltered page.
  const [filters, setFilters] = useState<LeadFilters>(() => ({
    ...defaultLeadFilters,
    market: searchParams.get("market") ?? defaultLeadFilters.market,
    project: searchParams.get("project") ?? defaultLeadFilters.project,
    source: searchParams.get("source") ?? defaultLeadFilters.source,
  }));
  const [showAddModal, setShowAddModal] = useState(false);
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetId, setBulkTargetId] = useState("");
  const [isBulkReassigning, setIsBulkReassigning] = useState(false);

  const markets = useMemo(
    () => Array.from(new Set(leads.map((l) => l.market))).sort(),
    [leads]
  );
  const projects = useMemo(
    () => Array.from(new Set(leads.map((l) => l.projectInterest))).sort(),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (
        filters.search &&
        !lead.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      if (filters.priority !== "All" && lead.priority !== filters.priority) {
        return false;
      }
      if (filters.stage !== "All" && lead.stage !== filters.stage) {
        return false;
      }
      if (filters.source !== "All" && lead.source !== filters.source) {
        return false;
      }
      if (filters.market !== "All" && lead.market !== filters.market) {
        return false;
      }
      if (filters.project !== "All" && lead.projectInterest !== filters.project) {
        return false;
      }
      if (filters.scoreBand !== "All" && scoreBand(lead.score) !== filters.scoreBand) {
        return false;
      }
      if (filters.overdueOnly && lead.nextActionDue !== "Overdue") {
        return false;
      }
      return true;
    });
  }, [filters, leads]);

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
      const allSelected = filteredLeads.every((l) => prev.has(l.id));
      if (allSelected) return new Set();
      return new Set(filteredLeads.map((l) => l.id));
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
            {filteredLeads.length} of {leads.length} leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadCsv(
                "sphaera-leads.csv",
                ["Name", "Contact", "Source", "Market", "Project", "Stage", "Score", "Engagement", "Priority", "Next Action Due", "Assignment", "Owner"],
                filteredLeads.map((l) => [
                  l.name,
                  l.contact,
                  l.source,
                  l.market,
                  l.projectInterest,
                  l.stage,
                  l.score,
                  l.engagement,
                  l.priority,
                  l.nextActionDue,
                  l.assignment,
                  l.assignedUserName ?? "",
                ])
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add lead
          </button>
        </div>
      </div>

      <LeadFilterBar filters={filters} onChange={setFilters} markets={markets} projects={projects} />

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

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              {isManagementView && assignableUsers.length > 0 && (
                <th className="pb-2 pr-2 font-normal">
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id))}
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
            {filteredLeads.map((lead) => (
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

        {filteredLeads.length === 0 && (
          <div className="mt-12 text-center text-sm text-ink-500">
            No leads match these filters. Try clearing one and searching
            again.
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}