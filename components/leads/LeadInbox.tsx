"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus, UserPlus } from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { LeadFilterBar, type LeadFilters } from "./LeadFilterBar";
import { AddLeadModal } from "./AddLeadModal";
import {
  PriorityBadge,
  StageBadge,
  ScoreBadge,
  EngagementIndicator,
} from "./LeadBadges";

const initialFilters: LeadFilters = {
  search: "",
  priority: "All",
  stage: "All",
  source: "All",
};

export function LeadInbox({
  initialLeads,
  currentUserId,
}: {
  initialLeads: Lead[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [showAddModal, setShowAddModal] = useState(false);

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
      return true;
    });
  }, [filters, leads]);

  async function handleAssignToMe(e: React.MouseEvent, leadId: string) {
    e.stopPropagation(); // don't trigger the row's navigate-to-profile click
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, assignedUserId: currentUserId, assignedUserName: "You" }
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
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add lead
        </button>
      </div>

      <LeadFilterBar filters={filters} onChange={setFilters} />

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
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
                <td className="py-2.5">
                  {lead.assignedUserName ? (
                    <span className="text-[11px] text-ink-300">
                      {lead.assignedUserName}
                    </span>
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