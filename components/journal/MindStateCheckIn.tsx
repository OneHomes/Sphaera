"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

const MOODS: { score: number; label: string; emoji: string }[] = [
  { score: 1, label: "Struggling", emoji: "😞" },
  { score: 2, label: "Low", emoji: "🙁" },
  { score: 3, label: "Okay", emoji: "😐" },
  { score: 4, label: "Good", emoji: "🙂" },
  { score: 5, label: "Great", emoji: "😄" },
];

type TodayCheckIn = { mood: string; moodScore: number } | null;

export function MindStateCheckIn() {
  const [today, setToday] = useState<TodayCheckIn>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/mindstate")
      .then((res) => res.json())
      .then((data) => setToday(data.today ?? null))
      .finally(() => setLoaded(true));
  }, []);

  async function submit(score: number) {
    setSelected(score);
    setExpanded(true);
  }

  async function confirm() {
    if (selected === null) return;
    setIsSaving(true);
    try {
      const mood = MOODS.find((m) => m.score === selected)?.label ?? "";
      const res = await fetch("/api/mindstate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodScore: selected, mood, note }),
      });
      if (res.ok) {
        const created = await res.json();
        setToday(created);
        setExpanded(false);
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="mt-6 rounded-lg border border-base-700 bg-base-900 p-3">
      <p className="mb-2 flex items-center gap-1 text-[10px] text-ink-500">
        <Lock className="h-2.5 w-2.5" />
        Private — only you can see this
      </p>

      {today ? (
        <p className="text-xs text-ink-300">
          {MOODS.find((m) => m.label === today.mood)?.emoji ?? "✓"} You checked in as{" "}
          <span className="text-ink-50">{today.mood}</span> today.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs font-medium text-ink-50">How are you feeling?</p>
          <div className="flex items-center justify-between">
            {MOODS.map((m) => (
              <button
                key={m.score}
                onClick={() => submit(m.score)}
                aria-label={m.label}
                className={`rounded-full p-1.5 text-lg transition hover:bg-base-800 ${
                  selected === m.score ? "bg-base-800 ring-1 ring-ink-300" : ""
                }`}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          {expanded && (
            <div className="mt-2 space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional private note…"
                rows={2}
                className="w-full resize-none rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-[11px] text-ink-50 outline-none placeholder:text-ink-500"
              />
              <button
                onClick={confirm}
                disabled={isSaving}
                className="w-full rounded-lg bg-ink-50 py-1.5 text-[11px] font-semibold text-base-950 hover:bg-white disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save check-in"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
