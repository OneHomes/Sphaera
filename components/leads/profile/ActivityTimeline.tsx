import {
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
  ArrowRightCircle,
  CheckSquare,
} from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/lib/leadProfileData";

const iconMap: Record<TimelineEventType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  note: StickyNote,
  stage_change: ArrowRightCircle,
  task: CheckSquare,
};

const colorMap: Record<TimelineEventType, string> = {
  call: "text-sky-400 bg-sky-500/15",
  email: "text-violet-400 bg-violet-500/15",
  meeting: "text-status-active bg-status-active/15",
  note: "text-ink-300 bg-base-700",
  stage_change: "text-status-alert bg-status-alert/15",
  task: "text-status-active bg-status-active/15",
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h2 className="mb-4 text-sm font-medium text-ink-50">
        Activity timeline
      </h2>
      <ol className="space-y-4">
        {events.map((event, i) => {
          const Icon = iconMap[event.type];
          const isLast = i === events.length - 1;
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
              <div className="pb-1">
                <p className="text-xs text-ink-300">{event.summary}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {event.timestamp}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
