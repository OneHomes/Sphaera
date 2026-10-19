"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
  ArrowRightCircle,
  CheckSquare,
  Repeat,
} from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/lib/leadProfileData";

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

// A HubSpot-imported lead can carry well over a thousand historical
// events (old email threads, meetings, etc.) — rendering all of them at
// once made the profile page heavy and the page.tsx query now orders
// newest-first, so "show more" reveals older history on demand instead
// of forcing a huge initial render.
const PAGE_SIZE = 30;

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = events.slice(0, visibleCount);

  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h2 className="mb-4 flex items-baseline gap-2 text-sm font-medium text-ink-50">
        Activity timeline
        {events.length > 0 && (
          <span className="text-xs font-normal text-ink-500">({events.length})</span>
        )}
      </h2>
      {events.length === 0 ? (
        <p className="text-xs text-ink-500">No activity logged yet.</p>
      ) : (
        <>
          <ol className="space-y-4">
            {visible.map((event, i) => {
              const Icon = iconMap[event.type];
              const isLast = i === visible.length - 1;
              return (
                <li key={event.id} className="relative flex gap-3">
                  {!isLast && (
                    <span className="absolute left-3.5 top-8 h-full w-px bg-base-700" />
                  )}
                  <span
                    className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorMap[event.type]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 pb-1">
                    <p className="whitespace-pre-line break-words text-xs text-ink-300">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {event.timestamp}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {visibleCount < events.length && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="mt-4 w-full rounded-lg border border-base-700 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              Show {Math.min(PAGE_SIZE, events.length - visibleCount)} more (
              {events.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
