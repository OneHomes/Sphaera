"use client";

import { TrendingUp } from "lucide-react";
import { pipelineStages, type Opportunity, type OpportunityStage } from "@/lib/pipelineData";

// PRD 5.2 #11 — "pipeline value and weighted forecast accuracy." Value ×
// probability, aggregated by stage — derived client-side from the same
// opportunities PipelineBoard already holds, no separate fetch needed.
export function PipelineForecastCard({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  const openStages: OpportunityStage[] = pipelineStages.filter(
    (s) => s !== "Closed Won" && s !== "Closed Lost"
  );
  const open = opportunities.filter((o) => openStages.includes(o.stage));

  const weightedTotal = open.reduce(
    (sum, o) => sum + (o.value * o.probability) / 100,
    0
  );
  const rawTotal = open.reduce((sum, o) => sum + o.value, 0);

  const byStage = openStages
    .map((stage) => {
      const inStage = open.filter((o) => o.stage === stage);
      return {
        stage,
        count: inStage.length,
        weighted: inStage.reduce((sum, o) => sum + (o.value * o.probability) / 100, 0),
      };
    })
    .filter((s) => s.count > 0);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="mb-4 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-ink-300" />
        <h3 className="text-sm font-medium text-ink-50">Weighted Forecast</h3>
      </div>

      <div className="mb-3 flex gap-6">
        <div>
          <p className="text-xs text-ink-500">Weighted (probability-adjusted)</p>
          <p className="text-lg font-semibold text-ink-50">{fmt(weightedTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">Raw open pipeline</p>
          <p className="text-lg font-semibold text-ink-300">{fmt(rawTotal)}</p>
        </div>
      </div>

      {byStage.length > 0 ? (
        <div className="space-y-1.5">
          {byStage.map((s) => (
            <div key={s.stage} className="flex items-center justify-between text-xs">
              <span className="text-ink-300">
                {s.stage} ({s.count})
              </span>
              <span className="text-ink-50">{fmt(s.weighted)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-500">No open opportunities yet.</p>
      )}

      <p className="mt-3 border-t border-base-700 pt-2 text-[10px] text-ink-600">
        Medium confidence — based on each opportunity's current stage probability, not a
        historical win-rate model. Source: all open opportunities as of now.
      </p>
    </div>
  );
}
