"use client";

import { useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { Sparkles, Loader2 } from "lucide-react";

export function JanusCoachingCard() {
  const [insight, setInsight] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetCoaching() {
    setIsAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Give me one short, practical piece of coaching based on my current tier, points, badges, and streaks. Be specific and encouraging, not generic.",
          scope: "aex",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Janus request failed");
      }

      const data = await res.json();
      setInsight(data.answer);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't reach Janus right now."
      );
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <WidgetCard title="Janus Coaching" icon={Sparkles}>
      {insight ? (
        <p className="text-xs leading-relaxed text-ink-300">{insight}</p>
      ) : (
        <p className="text-xs text-ink-500">
          Get a personalised coaching tip based on your real tier, points,
          badges, and streaks.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-status-inactive">{error}</p>
      )}

      <button
        onClick={handleGetCoaching}
        disabled={isAsking}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-base-600 bg-base-800 py-2 text-xs font-medium text-ink-50 hover:bg-base-700 disabled:opacity-60"
      >
        {isAsking ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </>
        ) : insight ? (
          "Get new tip"
        ) : (
          "Get coaching from Janus"
        )}
      </button>
    </WidgetCard>
  );
}