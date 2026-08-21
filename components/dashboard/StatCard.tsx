import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  icon: Icon,
  value,
  valueColorClass = "text-ink-50",
}: {
  title: string;
  icon?: LucideIcon;
  value: string;
  valueColorClass?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-ink-300" strokeWidth={1.75} />}
        <h3 className="text-sm font-medium text-ink-50">{title}</h3>
      </div>
      <p className={`text-4xl font-semibold ${valueColorClass}`}>{value}</p>
    </div>
  );
}
