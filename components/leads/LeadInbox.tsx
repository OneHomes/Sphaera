"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { leads as allLeads } from "@/lib/leadData";
import { LeadFilterBar, type LeadFilters } from "./LeadFilterBar";
import {
  PriorityBadge,
  StageBadge,
  ScoreBadge,
  EngagementIndicator,
  AssignmentBadge,
} from "./LeadBadges";

const initialFilters: LeadFilters = {
  search: "",
  priority: "All",
  stage: "All",
  source: "All",
};

export function LeadInbox() {
  const router = useRouter();
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);

  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
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
  }, [filters]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-ink-50">Lead Inbox</h1>
        <p className="mt-1 text-sm text-ink-500">
          {filteredLeads.length} of {allLeads.length} leads
        </p>
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
                  <AssignmentBadge status={lead.assignment} />
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
    </div>
  );
}
