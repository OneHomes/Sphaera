"use client";

import { useState } from "react";
import { MapPin, Award, PieChart, Users2, Layers, Paperclip } from "lucide-react";
import { PromptCard } from "./PromptCard";

const suggestedPrompts = [
  {
    icon: MapPin,
    iconColorClass: "text-amber-400",
    label: "City based optimal response times",
  },
  {
    icon: Award,
    iconColorClass: "text-rose-400",
    label: "Who is the most productive agent right now?",
  },
  {
    icon: PieChart,
    iconColorClass: "text-emerald-400",
    label: "Share customer equity index",
  },
  {
    icon: Users2,
    iconColorClass: "text-sky-400",
    label: "Shift @teamx focus to the European markets",
  },
  {
    icon: Layers,
    iconColorClass: "text-ink-300",
    label: "Command library…",
  },
];

export function CommandCenter() {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    // TODO: send `query` to the Janus API route (Azure AI Foundry-backed)
    // once the Ask/Explain/Prepare/Act orchestration endpoint exists.
    console.log("Janus query submitted:", query);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <JanusGlyph />

      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {suggestedPrompts.map((prompt) => (
          <PromptCard
            key={prompt.label}
            icon={prompt.icon}
            iconColorClass={prompt.iconColorClass}
            label={prompt.label}
            onSelect={setQuery}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-900 px-4 py-3">
          <Paperclip className="h-4 w-4 shrink-0 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are we working on today?"
            className="w-full bg-transparent text-sm text-ink-50 outline-none placeholder:text-ink-500"
          />
        </div>
        <p className="mt-3 text-center text-xs text-ink-500">
          Driven by your internal data and continuously learns from how you
          use Sphaera.
        </p>
      </form>
    </div>
  );
}

function JanusGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10 text-ink-50">
      <path
        d="M14 10c8 0 8 6 16 6s8-6 16-6M14 24c8 0 8 6 16 6s8-6 16-6M14 38c8 0 8 6 16 6s8-6 16-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
