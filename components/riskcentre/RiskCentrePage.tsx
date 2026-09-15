import Link from "next/link";
import { AlertTriangle, TrendingDown, Users, Clock } from "lucide-react";
import type { RiskAlert } from "@/lib/riskCentre";
import { TeamFocusCard } from "./TeamFocusCard";

const categoryIcon: Record<RiskAlert["category"], typeof AlertTriangle> = {
  target: AlertTriangle,
  opportunity: TrendingDown,
  agent_workload: Users,
  stale_lead: Clock,
};

const categoryLabel: Record<RiskAlert["category"], string> = {
  target: "Target",
  opportunity: "Pipeline",
  agent_workload: "Workload",
  stale_lead: "Stale Lead",
};

const severityStyles: Record<RiskAlert["severity"], string> = {
  critical: "border-status-inactive/40 bg-status-inactive/10",
  warning: "border-status-alert/40 bg-status-alert/10",
};

export function RiskCentrePage({ alerts }: { alerts: RiskAlert[] }) {
  const critical = alerts.filter((a) => a.severity === "critical");
  const warning = alerts.filter((a) => a.severity === "warning");

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">
        Risk &amp; Alert Centre
      </h1>
      <p className="mb-5 text-sm text-ink-500">
        {critical.length} critical · {warning.length} warning
      </p>

      <div className="mb-4 max-w-3xl">
        <TeamFocusCard />
      </div>

      <div className="max-w-3xl space-y-2">
        {alerts.map((alert) => {
          const Icon = categoryIcon[alert.category];
          return (
            <Link
              key={alert.id}
              href={alert.href}
              className={`flex items-center gap-3 rounded-lg border p-3 transition hover:brightness-110 ${severityStyles[alert.severity]}`}
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-50">
                  {alert.title}
                </p>
                <p className="text-[11px] text-ink-500">{alert.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full bg-base-800 px-2 py-0.5 text-[10px] text-ink-500">
                {categoryLabel[alert.category]}
              </span>
            </Link>
          );
        })}

        {alerts.length === 0 && (
          <div className="rounded-xl border border-status-active/30 bg-status-active/10 p-6 text-center">
            <p className="text-sm text-ink-50">No risks detected right now.</p>
            <p className="text-xs text-ink-500">
              Targets on pace, no stale leads, no at-risk opportunities.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 max-w-3xl text-[11px] text-ink-500">
        Thresholds are provisional pending business sign-off (PRD AV13).
      </p>
    </div>
  );
}