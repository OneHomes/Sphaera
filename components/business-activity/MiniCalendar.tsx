"use client";

import { CalendarDays, Search, Plus } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type MiniEvent = {
  label: string;
  startHour: number;
  endHour: number;
  colorClass: string;
};

// Static placeholder events/month grid. Real version reads from the
// embedded Google Calendar / Microsoft 365 connector (PRD AE13 / PF09) —
// this panel is a lightweight team-schedule glance, not the full
// calendar module (which lives at /calendar once that embed is built).
const events: MiniEvent[] = [
  { label: "Site viewing — Evelyn Hayes", startHour: 9, endHour: 10, colorClass: "bg-status-active/20 text-status-active border-status-active/40" },
  { label: "Team stand-up", startHour: 10, endHour: 11, colorClass: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  { label: "Client call — Theodore Vance", startHour: 13, endHour: 14, colorClass: "bg-violet-500/20 text-violet-400 border-violet-500/40" },
  { label: "Proposal review", startHour: 14, endHour: 15, colorClass: "bg-rose-500/20 text-rose-400 border-rose-500/40" },
];

const hours = Array.from({ length: 9 }, (_, i) => 8 + i); // 8am - 4pm

function formatHour(hour: number) {
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function MiniMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="w-36 shrink-0 border-r border-base-700 pr-3">
      <p className="mb-2 text-[11px] font-medium text-ink-50">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[9px] text-ink-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={`flex h-5 w-5 items-center justify-center justify-self-center rounded-full ${
              day === today.getDate() ? "bg-status-active text-base-950 font-medium" : "text-ink-300"
            }`}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MiniCalendar() {
  const today = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <WidgetCard
      title="Team Calendar — Today"
      icon={CalendarDays}
      action={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Search events"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-base-700 text-ink-500 hover:border-base-600 hover:text-ink-50"
          >
            <Search className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-base-700 bg-base-800 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <Plus className="h-3 w-3" />
            Add event
          </button>
        </div>
      }
    >
      <p className="mb-2 text-[11px] text-ink-500">{today}</p>
      <div className="flex gap-3">
        <MiniMonth />
        <div className="min-w-0 flex-1 space-y-0.5">
          {hours.map((hour) => {
            const event = events.find((e) => hour >= e.startHour && hour < e.endHour);
            const isEventStart = event?.startHour === hour;
            return (
              <div key={hour} className="flex items-center gap-2 text-[11px]">
                <span className="w-11 shrink-0 text-ink-500">{formatHour(hour)}</span>
                <div className="h-7 flex-1 rounded border border-base-700">
                  {event && isEventStart && (
                    <div
                      className={`flex h-full items-center justify-between truncate rounded border-l-2 px-2 text-[10px] ${event.colorClass}`}
                    >
                      <span className="truncate">{event.label}</span>
                      <span className="shrink-0 opacity-70">
                        {formatHour(event.startHour)}–{formatHour(event.endHour)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}
