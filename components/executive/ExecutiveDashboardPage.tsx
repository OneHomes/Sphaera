import Link from "next/link";
import {
  Briefcase,
  DollarSign,
  Users,
  Building2,
  AlertTriangle,
  Target,
  ClipboardList,
} from "lucide-react";
import type { ExecutiveSummary } from "@/lib/executiveDashboard";
import type { PilotMetric } from "@/lib/pilotMetrics";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function StatBox({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-ink-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${accent ?? "text-ink-50"}`}>
        {value}
      </p>
    </div>
  );
}

export function ExecutiveDashboardPage({
  summary,
  pilotMetrics,
}: {
  summary: ExecutiveSummary;
  pilotMetrics: PilotMetric[];
}) {
  const maxStageValue = Math.max(
    ...summary.pipelineByStage.map((s) => s.value),
    1
  );

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">
        {summary.scope === "company" ? "Executive Command Dashboard" : "Team Command Dashboard"}
      </h1>
      <p className="mb-5 text-sm text-ink-500">
        {summary.scope === "company" ? "Company-wide overview" : "Your team's overview"}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox
          icon={Briefcase}
          label="Active Pipeline"
          value={formatCurrency(summary.totalActivePipelineValue)}
        />
        <StatBox
          icon={DollarSign}
          label="Revenue (This Year)"
          value={formatCurrency(summary.totalClosedRevenueThisYear)}
          accent="text-status-active"
        />
        <StatBox
          icon={Target}
          label="Weighted Forecast"
          value={formatCurrency(summary.weightedForecastValue)}
          accent="text-sky-400"
        />
        <StatBox
          icon={Users}
          label="Active Leads"
          value={summary.totalActiveLeads.toLocaleString()}
        />
        <StatBox
          icon={Building2}
          label={summary.scope === "company" ? "Teams / Agents" : "Agents"}
          value={
            summary.scope === "company"
              ? `${summary.totalTeams} / ${summary.totalAgents}`
              : `${summary.totalAgents}`
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pipeline by stage */}
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-50">
            Pipeline by Stage
          </h2>
          <div className="space-y-2">
            {summary.pipelineByStage.map((s) => (
              <div key={s.stage}>
                <div className="flex justify-between text-[11px] text-ink-300">
                  <span>{s.stage}</span>
                  <span>
                    {s.count} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-base-700">
                  <div
                    className="h-1.5 rounded-full bg-status-active"
                    style={{
                      width: `${(s.value / maxStageValue) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk + Targets summary */}
        <div className="space-y-4">
          <Link
            href="/risk-centre"
            className="block rounded-xl border border-base-700 bg-base-900 p-4 hover:border-base-600"
          >
            <div className="mb-2 flex items-center gap-2 text-ink-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">Risk & Alert Centre</span>
            </div>
            <p className="text-sm text-ink-50">
              <span className="font-semibold text-status-inactive">
                {summary.criticalRiskCount}
              </span>{" "}
              critical ·{" "}
              <span className="font-semibold text-status-alert">
                {summary.warningRiskCount}
              </span>{" "}
              warning
            </p>
          </Link>

          <Link
            href="/targets"
            className="block rounded-xl border border-base-700 bg-base-900 p-4 hover:border-base-600"
          >
            <div className="mb-2 flex items-center gap-2 text-ink-500">
              <Target className="h-4 w-4" />
              <span className="text-xs">Target Progress</span>
            </div>
            <p className="text-sm text-ink-50">
              <span className="font-semibold text-status-active">
                {summary.targetsOnPaceCount}
              </span>{" "}
              on pace ·{" "}
              <span className="font-semibold text-status-alert">
                {summary.targetsBehindPaceCount}
              </span>{" "}
              behind pace
            </p>
          </Link>
        </div>
      </div>

      {/* Team performance table */}
      <div className="max-w-4xl rounded-xl border border-base-700 bg-base-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-50">
          Team Performance
        </h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Team</th>
              <th className="pb-2 pr-3 font-normal text-right">Members</th>
              <th className="pb-2 pr-3 font-normal text-right">Pipeline</th>
              <th className="pb-2 pr-3 font-normal text-right">Revenue</th>
              <th className="pb-2 font-normal text-right">Avg PI</th>
            </tr>
          </thead>
          <tbody>
            {summary.teamPerformance.map((team) => (
              <tr
                key={team.teamId}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {team.teamName}
                </td>
                <td className="py-2 pr-3 text-right">{team.memberCount}</td>
                <td className="py-2 pr-3 text-right">
                  {formatCurrency(team.totalPipelineValue)}
                </td>
                <td className="py-2 pr-3 text-right text-status-active">
                  {formatCurrency(team.totalRevenue)}
                </td>
                <td className="py-2 text-right">
                  {team.avgProductivityIndex}
                </td>
              </tr>
            ))}
            {summary.teamPerformance.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-ink-500">
                  No teams with members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-ink-300" />
          <h2 className="text-sm font-medium text-ink-50">Pilot Success Metrics</h2>
        </div>
        <p className="mb-3 text-[11px] text-ink-500">
          PRD Section 5.2 — real numbers where the data exists; metrics with
          no real source yet are marked rather than estimated.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pilotMetrics.map((m) => (
            <div
              key={m.key}
              className={`rounded-lg border p-3 text-xs ${
                m.tracked
                  ? "border-base-700 bg-base-800"
                  : "border-base-800 bg-base-900"
              }`}
            >
              <p className="text-ink-300">{m.label}</p>
              {m.tracked ? (
                <p className="mt-1 text-base font-semibold text-ink-50">{m.value}</p>
              ) : (
                <p className="mt-1 text-xs font-medium text-ink-600">Not yet tracked</p>
              )}
              <p className="mt-1 text-[10px] text-ink-500">{m.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}