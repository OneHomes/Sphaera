"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Target as TargetIcon } from "lucide-react";
import { TARGET_METRICS } from "@/lib/targetTracker";

type TeamOption = { id: string; name: string };

export function CreateTargetModal({
  teams,
  currentUserId,
  onClose,
}: {
  teams: TeamOption[];
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"self" | "team">("self");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [metric, setMetric] = useState("revenue");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd || !targetValue) {
      setError("All fields are required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: scope === "self" ? currentUserId : undefined,
          teamId: scope === "team" ? teamId : undefined,
          metric,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          targetValue: Number(targetValue),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create target");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Set target</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "self" | "team")}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            <option value="self">For myself</option>
            {teams.length > 0 && <option value="team">For a team</option>}
          </select>

          {scope === "team" && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            {TARGET_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
            />
          </div>

          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="Target value (e.g. 500000 or 50)"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <TargetIcon className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : "Set target"}
          </button>
        </form>
      </div>
    </div>
  );
}