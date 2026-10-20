"use client";

import { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
  ArrowRightCircle,
  CheckSquare,
  Repeat,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/lib/leadProfileData";

// Matches the interaction pattern of HubSpot's own activity timeline
// (type filter checkboxes, collapsed-by-default cards you expand for
// detail, a collapse/expand-all toggle, month section headers) — adapted
// to our dark theme and scoped to the 7 event types we actually have,
// not HubSpot's full generic list of ~44.

const iconMap: Record<TimelineEventType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  note: StickyNote,
  stage_change: ArrowRightCircle,
  task: CheckSquare,
  handover: Repeat,
};

const colorMap: Record<TimelineEventType, string> = {
  call: "text-sky-400 bg-sky-500/15",
  email: "text-violet-400 bg-violet-500/15",
  meeting: "text-status-active bg-status-active/15",
  note: "text-ink-300 bg-base-700",
  stage_change: "text-status-alert bg-status-alert/15",
  task: "text-status-active bg-status-active/15",
  handover: "text-tier-gold bg-tier-gold/15",
};

const typeLabels: Record<TimelineEventType, string> = {
  call: "Calls",
  email: "Emails",
  meeting: "Meetings",
  note: "Notes",
  stage_change: "Stage changes",
  task: "Tasks",
  handover: "Handovers",
};

const ALL_TYPES = Object.keys(typeLabels) as TimelineEventType[];
const PAGE_SIZE = 30;

function firstLine(summary: string): string {
  const idx = summary.indexOf("\n");
  const line = (idx === -1 ? summary : summary.slice(0, idx)).trim();
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function absoluteLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEventType>>(new Set(ALL_TYPES));
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => events.filter((e) => activeTypes.has(e.type)), [events, activeTypes]);
  const visible = filtered.slice(0, visibleCount);

  // Already fetched newest-first (app/(app)/leads/[id]/page.tsx) — group
  // into month sections without re-sorting, same as HubSpot's own layout.
  const grouped = useMemo(() => {
    const groups: { month: string; items: TimelineEvent[] }[] = [];
    for (const event of visible) {
      const month = monthLabel(event.occurredAt);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(event);
      else groups.push({ month, items: [event] });
    }
    return groups;
  }, [visible]);

  function toggleType(type: TimelineEventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-2 text-sm font-medium text-ink-50">
          Activity timeline
          {events.length > 0 && (
            <span className="text-xs font-normal text-ink-500">
              ({filtered.length}/{events.length})
            </span>
          )}
        </h2>
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="rounded-lg border border-base-700 px-2.5 py-1 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
              >
                Activity ({activeTypes.size}/{ALL_TYPES.length})
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-base-700 bg-base-800 p-2 shadow-lg">
                    {ALL_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-300 hover:bg-base-700"
                      >
                        <input
                          type="checkbox"
                          checked={activeTypes.has(type)}
                          onChange={() => toggleType(type)}
                          className="accent-status-active"
                        />
                        {typeLabels[type]}
                      </label>
                    ))}
                    <div className="mt-1 flex items-center justify-between border-t border-base-700 pt-1.5">
                      <button
                        onClick={() => setActiveTypes(new Set(ALL_TYPES))}
                        className="text-[11px] text-ink-500 hover:text-ink-300"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setActiveTypes(new Set())}
                        className="text-[11px] text-ink-500 hover:text-ink-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() =>
                setExpandedIds((prev) => (prev.size > 0 ? new Set() : new Set(visible.map((e) => e.id))))
              }
              className="rounded-lg border border-base-700 px-2.5 py-1 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              {expandedIds.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-ink-500">No activity logged yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-ink-500">No activity matches the selected filters.</p>
      ) : (
        <>
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.month}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  {group.month}
                </p>
                <ol className="space-y-2">
                  {group.items.map((event) => {
                    const Icon = iconMap[event.type];
                    const isExpanded = expandedIds.has(event.id);
                    return (
                      <li key={event.id} className="rounded-lg border border-base-700 bg-base-800/50">
                        <button
                          onClick={() =>
                            setExpandedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(event.id)) next.delete(event.id);
                              else next.add(event.id);
                              return next;
                            })
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                          )}
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colorMap[event.type]}`}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-ink-300">
                            {firstLine(event.summary)}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-500">{event.timestamp}</span>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-base-700 px-3 py-2 pl-9">
                            <p className="whitespace-pre-line break-words text-xs text-ink-300">
                              {event.summary}
                            </p>
                            <p className="mt-1 text-[11px] text-ink-500">{absoluteLabel(event.occurredAt)}</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="mt-4 w-full rounded-lg border border-base-700 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more (
              {filtered.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
