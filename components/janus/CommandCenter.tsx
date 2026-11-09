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
  ListPlus,
  History,
  Plus,
  ArrowUp,
  FileText,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { PromptCard } from "./PromptCard";
import { DailyBriefing } from "./DailyBriefing";
import { ConversationHistory } from "./ConversationHistory";
import { JanusOrb } from "./JanusOrb";
import { SphaeraWordmark } from "@/components/brand/SphaeraWordmark";
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

type ChatMessage = { role: "user" | "assistant"; content: string; escalated?: boolean; conflicts?: { docType: string; relatedTo: string }[] };

type Attachment = {
  id: string;
  name: string;
  status: "reading" | "ready" | "error";
  text?: string;
  truncated?: boolean;
  error?: string;
};
const MAX_ATTACHMENTS = 3;
const ACCEPTED_FILES = ".pdf,.txt,.csv,.md,.json";

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Each file is turned into text server-side (/api/janus/extract) as soon
  // as it's attached, so sending the question doesn't wait on parsing.
  function addFiles(files: FileList | File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (Array.from(files).length > picked.length) {
      setError(`Up to ${MAX_ATTACHMENTS} files can be attached to one question.`);
    }
    for (const file of picked) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setAttachments((prev) => [...prev, { id, name: file.name, status: "reading" }]);
      const form = new FormData();
      form.append("file", file);
      fetch("/api/janus/extract", { method: "POST", body: form })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error ?? "Couldn't read this file");
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "ready", text: data.text, truncated: data.truncated } : a))
          );
        })
        .catch((err) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "error", error: err instanceof Error ? err.message : "Couldn't read this file" } : a
            )
          );
        });
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // Drag and drop anywhere on the Command Center. dragenter/dragleave fire
  // for every child element, so a depth counter stops the highlight flickering.
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("Files")) e.preventDefault();
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
  };

  const readyAttachments = attachments.filter((a) => a.status === "ready");
  const isReadingFiles = attachments.some((a) => a.status === "reading");

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
    // Attaching a file and pressing send with no text asks for a summary.
    const question =
      query.trim() || (readyAttachments.length ? `Summarise the attached file${readyAttachments.length > 1 ? "s" : ""}.` : "");
    if (!question || isAsking || isReadingFiles) return;

    const sent = readyAttachments.map((a) => ({ name: a.name, text: a.text ?? "" }));
    setIsAsking(true);
    setError(null);
    setQuery("");
    setAttachments([]);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: sent.length ? `${question}\n\n[Attached: ${sent.map((a) => a.name).join(", ")}]` : question },
    ]);

    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationId,
          scope: isManagementView ? "management" : undefined,
          attachments: sent.length ? sent : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.detail) console.error("Janus ask detail:", data.detail);
        throw new Error(data?.error ?? "Janus request failed");
      }

      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, escalated: data.escalated, conflicts: data.conflicts },
      ]);
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
    // Empty state sits in the middle of the screen under the Sphaera logo;
    // once a conversation starts it flows from the top so answers read down.
    <div
      className={`relative flex min-h-full flex-col items-center gap-8 px-6 py-8 ${
        hasThread || isAsking ? "" : "justify-center"
      }`}
      {...dropHandlers}
    >
      <div
        className={
          hasThread || isAsking
            ? "flex w-full max-w-xl items-center justify-end"
            : "absolute right-6 top-6 flex items-center justify-end"
        }
      >
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

      {!hasThread && !isAsking && <SphaeraWordmark className="h-12 text-ink-50" />}

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
              {m.role === "assistant" && (m.conflicts?.length ?? 0) > 0 && (
                <p className="mb-2 rounded-lg border border-status-alert/40 bg-status-alert/10 px-2.5 py-1.5 text-xs text-status-alert">
                  Conflicting documents found — see above for details.
                </p>
              )}
              <p className="whitespace-pre-line break-words">{m.content}</p>
              {m.role === "assistant" && m.escalated && (
                <p className="mt-2 rounded-lg border border-status-alert/40 bg-status-alert/10 px-2.5 py-1.5 text-xs text-status-alert">
                  Janus couldn&apos;t fully answer this — your manager has been notified.
                </p>
              )}
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
        <div className="flex flex-col items-center gap-3 py-4 text-sm text-ink-500">
          <JanusOrb state="working" size={64} />
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
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-2">
            {attachments.map((a) => (
              <span
                key={a.id}
                title={a.error ?? (a.truncated ? `${a.name} (long file: Janus reads the first part)` : a.name)}
                className={`flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                  a.status === "error"
                    ? "border-status-inactive/40 bg-status-inactive/10 text-status-inactive"
                    : "border-base-700 bg-base-900 text-ink-300"
                }`}
              >
                {a.status === "reading" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : a.status === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="-mr-0.5 shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:text-ink-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className={`flex items-center gap-2 rounded-full border bg-base-900 py-1.5 pl-2 pr-1.5 transition focus-within:border-status-active ${
            isDragging ? "border-status-active ring-2 ring-status-active/30" : "border-base-700"
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_ATTACHMENTS}
            aria-label="Attach a file"
            title="Attach a file (PDF, TXT, CSV, MD, JSON) or drop it here"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-base-800 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = ""; // allow picking the same file again
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isDragging
                ? "Drop to attach"
                : hasThread
                  ? "Ask a follow-up…"
                  : "What are we working on today?"
            }
            className="w-full bg-transparent py-1.5 text-sm text-ink-50 outline-none focus-visible:outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={(!query.trim() && readyAttachments.length === 0) || isAsking || isReadingFiles}
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
