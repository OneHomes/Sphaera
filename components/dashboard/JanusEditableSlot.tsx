"use client";

import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { JanusGlyph } from "@/components/janus/JanusGlyph";

// NOTE: This does not literally reconfigure the dashboard's widget layout
// (that would need a dynamic widget-config engine, a separate, larger
// feature). What it genuinely does: sends the typed question to Janus,
// grounded in real lead data, and shows the answer here. Copy below was
// updated to reflect that honestly rather than promise layout editing.
export function JanusEditableSlot() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isAsking) return;

    setIsAsking(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt }),
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-700 bg-base-900 p-6 text-center">
      <JanusGlyph className="h-8 w-8 text-ink-300" />

      {answer ? (
        <p className="max-w-xs text-xs leading-relaxed text-ink-300">
          {answer}
        </p>
      ) : (
        <p className="max-w-xs text-sm text-ink-500">
          Ask Janus a business question — grounded in your real lead data.
        </p>
      )}

      {error && <p className="text-xs text-status-inactive">{error}</p>}

      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-800 px-3 py-2 transition focus-within:border-status-active">
          {isAsking ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-500" />
          ) : (
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          )}
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Which leads are overdue right now?"
            disabled={isAsking}
            className="w-full bg-transparent text-xs text-ink-50 outline-none focus-visible:outline-none placeholder:text-ink-500 disabled:opacity-60"
          />
        </div>
      </form>
    </div>
  );
}