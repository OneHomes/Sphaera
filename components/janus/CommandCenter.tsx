"use client";

import { useState } from "react";
import { MapPin, Award, PieChart, Users2, Layers, Paperclip, Loader2 } from "lucide-react";
import { PromptCard } from "./PromptCard";

const suggestedPrompts = [
  {
    icon: MapPin,
    iconColorClass: "text-amber-400",
    label: "Which leads should I contact first today?",
  },
  {
    icon: Award,
    iconColorClass: "text-rose-400",
    label: "What's overdue across my leads right now?",
  },
  {
    icon: PieChart,
    iconColorClass: "text-emerald-400",
    label: "Summarise my pipeline by stage",
  },
  {
    icon: Users2,
    iconColorClass: "text-sky-400",
    label: "Which leads have the highest engagement?",
  },
  {
    icon: Layers,
    iconColorClass: "text-ink-300",
    label: "Command library…",
  },
];

export function CommandCenter() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || isAsking) return;

    setIsAsking(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Janus request failed");
      }

      const data = await res.json();
      setAnswer(data.answer);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't reach Janus right now."
      );
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <JanusGlyph />

      {!answer && !isAsking && (
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
      )}

      {isAsking && (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Janus is thinking…
        </div>
      )}

      {answer && (
        <div className="w-full max-w-xl rounded-xl border border-base-700 bg-base-900 p-4">
          <p className="text-sm leading-relaxed text-ink-300">{answer}</p>
        </div>
      )}

      {error && <p className="text-xs text-status-inactive">{error}</p>}

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