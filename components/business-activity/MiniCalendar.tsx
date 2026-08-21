import { CalendarDays } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type MiniEvent = {
  label: string;
  startHour: number;
  durationHours: number;
  colorClass: string;
};

// Static placeholder events. Real version reads from the embedded
// Google Calendar / Microsoft 365 connector (PRD AE13 / PF09) — this
// panel is a lightweight team-schedule glance, not the full calendar
// module (which lives at /calendar once that embed is built).
const events: MiniEvent[] = [
  { label: "Site viewing — Evelyn Hayes", startHour: 9, durationHours: 1, colorClass: "bg-status-active/20 text-status-active" },
  { label: "Team stand-up", startHour: 10, durationHours: 1, colorClass: "bg-sky-500/20 text-sky-400" },
  { label: "Client call — Theodore Vance", startHour: 14, durationHours: 1, colorClass: "bg-violet-500/20 text-violet-400" },
];

const hours = Array.from({ length: 9 }, (_, i) => 8 + i); // 8am - 4pm

export function MiniCalendar() {
  return (
    <WidgetCard title="Team Calendar — Today" icon={CalendarDays}>
      <div className="space-y-0.5">
        {hours.map((hour) => {
          const event = events.find((e) => e.startHour === hour);
          return (
            <div key={hour} className="flex items-center gap-2 text-[11px]">
              <span className="w-12 shrink-0 text-ink-500">
                {hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
              </span>
              <div className="h-6 flex-1 rounded border border-base-700">
                {event && (
                  <div
                    className={`flex h-full items-center truncate rounded px-2 text-[10px] ${event.colorClass}`}
                  >
                    {event.label}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
