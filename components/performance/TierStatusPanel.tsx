import { Award } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { TierStatus, TargetGaugeData } from "@/lib/agentPerformanceMetrics";

const tierStyles: Record<TierStatus["tier"], string> = {
  Gold: "bg-tier-gold/15 text-tier-gold border-tier-gold/30",
  Silver: "bg-tier-silver/15 text-tier-silver border-tier-silver/30",
  Bronze: "bg-tier-bronze/15 text-tier-bronze border-tier-bronze/30",
};

export function TierStatusPanel({
  tier,
  targets,
}: {
  tier: TierStatus;
  targets: TargetGaugeData[];
}) {
  const atRiskTargets = targets.filter((t) => t.missedStreak > 0);

  return (
    <WidgetCard title="Tier Status" icon={Award}>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${tierStyles[tier.tier]}`}
        >
          {tier.tier} Tier
        </span>
        <div>
          <p className="text-sm font-medium text-ink-50">{tier.points.toLocaleString()} pts</p>
          {tier.nextTier ? (
            <p className="text-[11px] text-ink-500">
              {tier.pointsToNextTier.toLocaleString()} pts to {tier.nextTier}
            </p>
          ) : (
            <p className="text-[11px] text-ink-500">Highest tier reached</p>
          )}
        </div>
      </div>

      {atRiskTargets.length > 0 ? (
        <div className="mt-3 space-y-2">
          {atRiskTargets.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-status-inactive/30 bg-status-inactive/10 p-2"
            >
              <p className="text-xs font-medium text-status-inactive">
                {t.scopeLabel} · {t.metric} target at risk
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Missed {t.missedStreak} of your last {t.consideredPastTargets} periods —
                another miss puts your current tier progress at risk.
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-ink-500">
          No missed targets in your recent history — tier progress is on track.
        </p>
      )}
    </WidgetCard>
  );
}
