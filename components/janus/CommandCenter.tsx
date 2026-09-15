"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Award,
  PieChart,
  Users2,
  Layers,
  DollarSign,
  Target,
  Paperclip,
  Loader2,
  ListPlus,
  History,
  Plus,
  ArrowUp,
} from "lucide-react";
import { PromptCard } from "./PromptCard";
import { DailyBriefing } from "./DailyBriefing";
import { ConversationHistory } from "./ConversationHistory";
import { JanusGlyph } from "./JanusGlyph";
import { JanusFeedback } from "./JanusFeedback";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";

// Agent prompts point at the personal, lead-operational questions Janus
// can actually ground well today (JN02, scope: leadId/general). Admin/
// Manager prompts match the reference UI's management-flavored set —
// some of these (customer equity index, city-based response times, and
// especially "shift team focus", which is JN12 Focus Orchestration and
// isn't built) don't have real backing data yet, so Janus will honestly
// say so per its system prompt rather than invent an answer, same as any
// other question outside its grounded scope. Focus-by-campaign prompts
// specifically will also need real campaign data (Salesforce/Meta
// Ads/Google Ads — confirmed providers, deferred to post-data-audit)
// even once JN12's own approved-rules question is settled.
const agentPrompts = [
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

const managementPrompts = [
  {
    icon: MapPin,
    iconColorClass: "text-amber-400",
    label: "City based optimal response times",
  },
  {
    icon: Users2,
    iconColorClass: "text-rose-400",
    label: "Who is the most productive agent right now?",
  },
  {
    icon: DollarSign,
    iconColorClass: "text-emerald-400",
    label: "Share customer equity index",
  },
  {
    icon: Target,
    iconColorClass: "text-sky-400",
    label: "Shift @teamx focus to the European markets",
  },
  {
    icon: Layers,
    iconColorClass: "text-ink-300",
    label: "Command library…",
  },
];

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CommandCenter({ isManagementView = false }: { isManagementView?: boolean }) {
  const suggestedPrompts = isManagementView ? managementPrompts : agentPrompts;
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHistory) return;
    function handleClickOutside(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = query.trim();
    if (!question || isAsking) return;

    setIsAsking(true);
    setError(null);
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationId,
          scope: isManagementView ? "management" : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Janus request failed");
      }

      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't reach Janus right now."
      );
    } finally {
      setIsAsking(false);
    }
  }

  function handleNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setShowHistory(false);
  }

  async function handleResumeConversation(id: string) {
    setShowHistory(false);
    setIsAsking(true);
    try {
      const res = await fetch(`/api/janus/conversations/${id}`);
      if (!res.ok) throw new Error("Couldn't load that conversation");
      const data = await res.json();
      setConversationId(data.id);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that conversation");
    } finally {
      setIsAsking(false);
    }
  }

  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const hasThread = messages.length > 0;

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-8">
      <div className="flex w-full max-w-xl items-center justify-between">
        <JanusGlyph className="h-10 w-10 text-white" />
        <div className="flex items-center gap-2">
          {hasThread && (
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1 rounded-lg border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          )}
          {!isManagementView && (
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
              >
                <History className="h-3 w-3" />
                History
              </button>
              {showHistory && (
                <ConversationHistory onSelect={handleResumeConversation} />
              )}
            </div>
          )}
        </div>
      </div>

      {!hasThread && !isAsking && !isManagementView && <DailyBriefing />}

      {!hasThread && !isAsking && (
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

      {hasThread && (
        <div className="w-full max-w-xl space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 text-sm leading-relaxed ${
                m.role === "user"
                  ? "border-base-700 bg-base-800 text-ink-50"
                  : "border-base-700 bg-base-900 text-ink-300"
              }`}
            >
              <p>{m.content}</p>
              {m.role === "assistant" && conversationId && (
                <div className="mt-2 border-t border-base-700 pt-2">
                  <JanusFeedback context={`command:${conversationId}:${i}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAsking && (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Janus is thinking…
        </div>
      )}

      {lastAnswer && !isAsking && (
        <button
          onClick={() => setShowCreateTask(true)}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-300 transition hover:border-base-600 hover:text-ink-50"
        >
          <ListPlus className="h-3.5 w-3.5" />
          Create task from this
        </button>
      )}

      {showCreateTask && (
        <AddTaskModal
          heading="Create task from Janus"
          defaultTitle={[...messages].reverse().find((m) => m.role === "user")?.content ?? ""}
          defaultRelatedTo="Janus"
          source="Janus proposed"
          onClose={() => setShowCreateTask(false)}
        />
      )}

      {error && <p className="text-xs text-status-inactive">{error}</p>}

      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-900 py-1.5 pl-4 pr-1.5 transition focus-within:border-status-active">
          <Paperclip className="h-4 w-4 shrink-0 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={hasThread ? "Ask a follow-up…" : "What are we working on today?"}
            className="w-full bg-transparent py-1.5 text-sm text-ink-50 outline-none focus-visible:outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={!query.trim() || isAsking}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-base-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-base-700 disabled:text-ink-500"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-ink-500">
          Driven by your internal data and continuously learns from how you
          use Sphaera.
        </p>
      </form>
    </div>
  );
}
