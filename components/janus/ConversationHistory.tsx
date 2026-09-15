"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";

type ConversationSummary = { id: string; updatedAt: string; preview: string };

export function ConversationHistory({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/janus/conversations")
      .then((res) => (res.ok ? res.json() : []))
      .then(setConversations)
      .catch(() => setConversations([]));
  }, []);

  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-base-700 bg-base-900 p-2 shadow-lg">
      {conversations === null && (
        <div className="flex items-center gap-2 p-2 text-xs text-ink-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading…
        </div>
      )}
      {conversations?.length === 0 && (
        <p className="p-2 text-xs text-ink-500">No past conversations yet.</p>
      )}
      {conversations?.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-base-800"
        >
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
          <span className="truncate text-xs text-ink-300">{c.preview}</span>
        </button>
      ))}
    </div>
  );
}
