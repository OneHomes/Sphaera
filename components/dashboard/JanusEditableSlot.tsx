"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";

export function JanusEditableSlot() {
  const [prompt, setPrompt] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    // TODO: send `prompt` to the Janus dashboard-customization endpoint
    // once it exists — this should let Janus add/replace/reconfigure a
    // widget in this grid based on the natural-language request.
    console.log("Dashboard customization request:", prompt);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-700 bg-base-900 p-6 text-center">
      <JanusGlyph />
      <p className="max-w-xs text-sm text-ink-500">
        Replace widgets, build new dashboards, and compare data just by
        typing what you want.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-800 px-3 py-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Replace agent activity index with leaderboard..."
            className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
        </div>
      </form>
    </div>
  );
}

function JanusGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-8 w-8 text-ink-300">
      <path
        d="M14 10c8 0 8 6 16 6s8-6 16-6M14 24c8 0 8 6 16 6s8-6 16-6M14 38c8 0 8 6 16 6s8-6 16-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
