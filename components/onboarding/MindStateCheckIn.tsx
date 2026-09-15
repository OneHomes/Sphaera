"use client";

import { useState } from "react";
import {
  Frown,
  Meh,
  Smile,
  Laugh,
  Angry,
} from "lucide-react";

const moods = [
  { value: 0, score: 1, label: "Struggling", icon: Angry },
  { value: 25, score: 2, label: "Low", icon: Frown },
  { value: 50, score: 3, label: "Neutral", icon: Meh },
  { value: 75, score: 4, label: "Optimistic", icon: Smile },
  { value: 100, score: 5, label: "Energised", icon: Laugh },
];

function nearestMood(value: number) {
  return moods.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
  );
}

export function MindStateCheckIn({ onContinue }: { onContinue: () => void }) {
  const [value, setValue] = useState(75);
  const [privateNote, setPrivateNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const mood = nearestMood(value);

  async function handleSubmit() {
    setIsSaving(true);
    try {
      // PRD AE03 — real persistence (same endpoint as the Journal
      // sidebar's check-in). Raw note text stays private per PF02/19.5 —
      // only aggregated trend indicators are ever surfaced to managers,
      // and no manager-facing aggregation view reads this yet.
      await fetch("/api/mindstate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodScore: mood.score, mood: mood.label, note: privateNote }),
      });
    } finally {
      onContinue();
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-base-950 px-6 text-center">
      <h1 className="text-xl font-semibold text-ink-50">
        How are you feeling today?
      </h1>
      <p className="max-w-md text-xs text-ink-500">
        As we start the day (or continue through it), how are you feeling
        today, and how would you describe your current state of mind and
        energy?
      </p>

      <div
        className="my-4 h-40 w-40 rounded-full opacity-80"
        style={{
          background:
            "conic-gradient(from 0deg, #14b8a6, #f59e0b, #14b8a6, #f59e0b, #14b8a6)",
          filter: "blur(2px)",
        }}
      />

      <p className="text-lg font-medium text-ink-50">{mood.label}</p>

      <div className="w-full max-w-sm">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-status-active"
          style={{
            background:
              "linear-gradient(to right, #ef4444, #f59e0b, #14b8a6)",
            height: "4px",
            borderRadius: "999px",
          }}
        />
        <div className="mt-2 flex justify-between">
          {moods.map((m) => (
            <m.icon key={m.value} className="h-4 w-4 text-ink-500" />
          ))}
        </div>
      </div>

      <textarea
        value={privateNote}
        onChange={(e) => setPrivateNote(e.target.value)}
        placeholder="Optional private note (only you can see this)"
        rows={2}
        className="w-full max-w-sm resize-none rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
      />

      <button
        onClick={handleSubmit}
        disabled={isSaving}
        className="rounded-lg bg-status-active px-8 py-2.5 text-sm font-semibold text-base-950 hover:brightness-110 disabled:opacity-60"
      >
        {isSaving ? "Saving…" : "Next"}
      </button>
    </div>
  );
}
