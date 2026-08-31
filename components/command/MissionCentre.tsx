import Link from "next/link";
import { AlertTriangle, Clock, CheckSquare } from "lucide-react";
import type { MissionItem } from "@/lib/missionCentre";

const urgencyStyles: Record<MissionItem["urgency"], string> = {
  critical: "border-status-inactive/40 bg-status-inactive/10",
  high: "border-status-alert/40 bg-status-alert/10",
  medium: "border-base-700 bg-base-900",
};

const iconFor: Record<MissionItem["type"], typeof AlertTriangle> = {
  overdue_lead: AlertTriangle,
  due_lead: Clock,
  overdue_task: AlertTriangle,
  due_task: CheckSquare,
};

export function MissionCentre({ items }: { items: MissionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-status-active/30 bg-status-active/10 p-4 text-center">
        <p className="text-sm text-ink-50">Nothing urgent right now.</p>
        <p className="text-xs text-ink-500">
          No overdue leads or tasks today.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 w-full max-w-2xl">
      <h2 className="mb-2 text-sm font-medium text-ink-50">
        Today&apos;s Mission — {items.length} item
        {items.length === 1 ? "" : "s"}
      </h2>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => {
          const Icon = iconFor[item.type];
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition hover:brightness-110 ${urgencyStyles[item.urgency]}`}
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-50">
                  {item.title}
                </p>
                <p className="text-[11px] text-ink-500">{item.subtitle}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {items.length > 8 && (
        <p className="mt-2 text-center text-[11px] text-ink-500">
          +{items.length - 8} more — check Leads and Tasks
        </p>
      )}
    </div>
  );
}