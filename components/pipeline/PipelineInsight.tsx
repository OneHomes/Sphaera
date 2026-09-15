"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { JanusGlyph } from "@/components/janus/JanusGlyph";

const quickQuestions = [
  "What needs attention in my pipeline right now?",
  "Which deals are most at risk of falling through?",
  "Summarise my pipeline by stage",
];

export function PipelineInsight() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim() || isAsking) return;
    setIsAsking(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, scope: "pipeline" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.detail) console.error("Janus ask detail:", data.detail);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="mb-4 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <JanusGlyph className="h-4 w-4 text-white" />
        <h3 className="text-sm font-medium text-ink-50">Ask Janus about the pipeline</h3>
      </div>

      {!answer && !isAsking && (
        <div className="mb-3 flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full border border-base-700 bg-base-800 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {isAsking && (
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Janus is analysing your pipeline…
        </div>
      )}

      {answer && (
        <div className="mb-3 rounded-lg border border-base-700 bg-base-800 p-3">
          <p className="text-xs leading-relaxed text-ink-300">{answer}</p>
        </div>
      )}

      {error && <p className="mb-3 text-xs text-status-inactive">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a custom question about your pipeline…"
          className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          disabled={isAsking}
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
        >
          <Sparkles className="h-3 w-3" />
          Ask
        </button>
      </form>
    </div>
  );
}