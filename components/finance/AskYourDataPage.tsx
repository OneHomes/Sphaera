"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = [
  "What's our current operating spend this month?",
  "How much historical debt have we paid so far?",
  "Which department has the highest spend?",
  "How many payments still need to be classified?",
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
        <h1 className="text-xl font-semibold text-ink-50">Ask Your Data</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ask Janus questions about your Finance ledger — grounded only on real recorded data.
        </p>
      </div>

      <WidgetCard title="Finance Assistant" icon={Sparkles} className="flex-1">
        <div className="flex h-full flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
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
            {loading && <div className="w-fit rounded-lg bg-base-800 px-3 py-2 text-xs text-ink-500">Thinking…</div>}
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
              placeholder="Ask about spend, budgets, disputes…"
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
    </div>
  );
}
