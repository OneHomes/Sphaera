"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";

type ConversationSummary = {
  id: string;
  clientName: string;
  clientPhone: string;
  leadId: string | null;
  lastMessage: string;
  lastMessageAt: string;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  createdAt: string;
};

// This is a polling-based MVP (refetches every few seconds) rather than
// a real-time websocket/SSE connection — simpler to build and reliable
// on Azure Static Web Apps' serverless functions, at the cost of a few
// seconds of latency on new incoming messages versus true real-time.
const POLL_INTERVAL_MS = 5000;

export function MessagesPage({
  connectedNumber,
}: {
  connectedNumber: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const res = await fetch("/api/whatsapp/conversations");
    if (res.ok) {
      const data: ConversationSummary[] = await res.json();
      setConversations(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    }
  }

  async function loadMessages(conversationId: string) {
    const res = await fetch(
      `/api/whatsapp/conversations/${conversationId}/messages`
    );
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    const interval = setInterval(() => loadMessages(selectedId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !selectedId || isSending) return;

    const text = draft.trim();
    setDraft("");
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/whatsapp/conversations/${selectedId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send message");
      }

      const sent: Message = await res.json();
      setMessages((prev) => [...prev, sent]);
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setDraft(text); // restore draft so nothing is lost
    } finally {
      setIsSending(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-80 shrink-0 min-h-0 flex-col border-r border-base-700">
        <div className="shrink-0 border-b border-base-700 p-3">
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <MessageCircle className="h-3.5 w-3.5" />
            {connectedNumber}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full border-b border-base-700 p-3 text-left transition ${
                selectedId === c.id ? "bg-base-900" : "hover:bg-base-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-50">
                  {c.clientName}
                </span>
                <span className="text-[10px] text-ink-500">
                  {new Date(c.lastMessageAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-ink-500">
                {c.lastMessage}
              </p>
              {c.leadId && (
                <span className="mt-1 inline-block rounded-full bg-status-active/15 px-1.5 py-0.5 text-[9px] text-status-active">
                  Linked to Lead
                </span>
              )}
            </button>
          ))}

          {conversations.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-500">
              No conversations yet. They&apos;ll appear here once a client
              messages your connected number.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="shrink-0 border-b border-base-700 p-4">
              <p className="text-sm font-medium text-ink-50">
                {selected.clientName}
              </p>
              <p className="text-xs text-ink-500">{selected.clientPhone}</p>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-xs ${
                      m.direction === "outbound"
                        ? "bg-status-active/20 text-ink-50"
                        : "bg-base-800 text-ink-300"
                    }`}
                  >
                    <p>{m.content}</p>
                    <p className="mt-1 text-[10px] text-ink-500">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {m.direction === "outbound" && ` · ${m.status}`}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <p className="shrink-0 px-4 text-xs text-status-inactive">
                {error}
              </p>
            )}

            <form
              onSubmit={handleSend}
              className="flex shrink-0 gap-2 border-t border-base-700 p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}