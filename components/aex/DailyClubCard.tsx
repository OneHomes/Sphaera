import { Sun, Crown } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// PRD AEX 14.5 — Daily Club (today's real point threshold) and a
// longer-period classification (this month's real top point earner).
export function DailyClubCard({
  dailyClub,
  monthlyChampion,
}: {
  dailyClub: { qualified: boolean; todayPoints: number; threshold: number };
  monthlyChampion: { id: string; name: string; points: number } | null;
}) {
  return (
    <WidgetCard title="Daily Club" icon={Sun}>
      {dailyClub.qualified ? (
        <p className="text-xs text-status-active">
          You're in today's Daily Club — {dailyClub.todayPoints} points earned today.
        </p>
      ) : (
        <p className="text-xs text-ink-300">
          {dailyClub.todayPoints}/{dailyClub.threshold} points today —{" "}
          {dailyClub.threshold - dailyClub.todayPoints} more to join today's Daily Club.
        </p>
      )}

      {monthlyChampion && (
        <div className="mt-3 flex items-center gap-2 border-t border-base-700 pt-3">
          <Crown className="h-4 w-4 text-tier-gold" />
          <p className="text-xs text-ink-300">
            <span className="text-ink-50">{monthlyChampion.name}</span> is this
            month's top earner — {monthlyChampion.points.toLocaleString()} pts.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
