"use client";

import { useEffect, useState } from "react";
import { Flame, Award, AlertTriangle, Loader2 } from "lucide-react";
import { JanusFeedback } from "./JanusFeedback";

type BriefingData = {
  briefing: string;
  missionCount: number;
  overdueCount: number;
  tier: string;
  points: number;
  streakDays: number;
};

type Period = "day" | "week";

export function DailyBriefing() {
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<BriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/janus/briefing?period=${period}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Couldn't load your briefing.");
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your briefing.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="w-full max-w-xl rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-2 flex items-center gap-1 text-[11px]">
        {(["day", "week"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-2.5 py-1 ${
              period === p
                ? "bg-ink-50 text-base-950"
                : "border border-base-700 text-ink-500 hover:text-ink-300"
            }`}
          >
            {p === "day" ? "Today" : "This Week"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-2 text-xs text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {period === "day" ? "Preparing your daily briefing…" : "Preparing your weekly rollup…"}
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="py-2 text-xs text-ink-500">Couldn&apos;t load your briefing.</p>
      )}

      {!isLoading && data && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3" />
              {data.tier} · {data.points} pts
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-status-alert" />
              {data.streakDays} day streak
            </span>
            {data.overdueCount > 0 && (
              <span className="flex items-center gap-1 text-status-inactive">
                <AlertTriangle className="h-3 w-3" />
                {data.overdueCount} overdue
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-ink-300">{data.briefing}</p>
          <div className="mt-3 border-t border-base-700 pt-2">
            <JanusFeedback context={period === "week" ? "weekly-briefing" : "briefing"} />
          </div>
        </>
      )}
    </div>
  );
}
