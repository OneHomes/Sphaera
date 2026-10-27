"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = [
  "Why did we overspend in July?",
  "Which cost heads have the highest expenditure?",
  "How much old debt have we cleared?",
  "What should we cut or change next year?",
];

export function AskYourDataPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/finance/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setMessages(nextMessages);
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch {
      setError("Couldn't reach Janus. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Ask the commercial data</h1>
        <p className="mt-1 text-sm text-ink-500">
          Speak naturally, without finance terminology. Ask about overspends, missing classifications, historical
          debt, suppliers and suggestions for next year.
        </p>
      </div>

      <WidgetCard title="Finance Assistant" icon={Sparkles} className="flex-1">
        <div className="flex h-full flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
              Powered by Janus
            </span>
            <span className="text-[11px] text-ink-500">Chat never changes payments automatically</span>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ink-500">
                  Ask anything about the financial data. The assistant can query the ledger for evidence.
                </p>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-ink-500">Try asking:</p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-fit rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-left text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  m.role === "user"
                    ? "ml-auto bg-ink-50 text-base-950"
                    : "bg-base-800 text-ink-300"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="w-fit rounded-lg bg-base-800 px-3 py-2 text-xs text-ink-500">
                Analysing the database...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-2 text-xs text-status-inactive">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="For example, where did the money go in July and how can we improve next year?"
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
              Send
            </button>
          </form>
        </div>
      </WidgetCard>

      <p className="mt-3 text-[11px] text-ink-600">
        This is an API-connected analyst, not a general chat assistant. Selected financial aggregates and
        transaction details are sent to Sphaera&apos;s Janus to answer your question.
      </p>
    </div>
  );
}
