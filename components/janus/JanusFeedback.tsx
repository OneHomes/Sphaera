"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";

// PRD JN14 — every material Janus output must support "was this
// useful?" plus accept/edit/reject/report. This covers the "useful"
// half for surfaces that don't already have a richer accept/edit/reject
// flow of their own (Next Best Action and Compose do, via their own
// CTAs). `context` identifies what's being rated (e.g. "briefing",
// "leadSummary:<leadId>", "coaching", "command:<messageId>").
export function JanusFeedback({ context }: { context: string }) {
  const [sent, setSent] = useState<"useful" | "not_useful" | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function send(useful: boolean) {
    if (isSending || sent) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/janus/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, useful }),
      });
      if (res.ok) setSent(useful ? "useful" : "not_useful");
    } finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <p className="flex items-center gap-1 text-[10px] text-ink-500">
        <Check className="h-3 w-3" />
        Thanks for the feedback
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-ink-500">Was this useful?</span>
      <button
        onClick={() => send(true)}
        disabled={isSending}
        aria-label="Useful"
        className="rounded p-1 text-ink-500 hover:bg-base-800 hover:text-status-active disabled:opacity-50"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => send(false)}
        disabled={isSending}
        aria-label="Not useful"
        className="rounded p-1 text-ink-500 hover:bg-base-800 hover:text-status-inactive disabled:opacity-50"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
