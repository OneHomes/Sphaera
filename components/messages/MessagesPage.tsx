"use client";

import { useState } from "react";
import { Search, Send, Phone, Video } from "lucide-react";
import { conversations } from "@/lib/messagesData";

export function MessagesPage() {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const selected = conversations.find((c) => c.id === selectedId);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    // TODO: send via the real messaging connector once available.
    console.log(`Send to ${selected?.name}: ${draft}`);
    setDraft("");
  }

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 border-r border-base-700">
        <div className="border-b border-base-700 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-500" />
            <input
              placeholder="Search or start new chat"
              className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
          </div>
        </div>
        <div className="overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`flex w-full items-center gap-2.5 border-b border-base-700 p-3 text-left transition ${
                selectedId === conv.id ? "bg-base-900" : "hover:bg-base-900"
              }`}
            >
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-base-700 text-xs font-medium text-ink-50">
                {conv.name.charAt(0)}
                {conv.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-base-950 bg-status-active" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-50">
                    {conv.name}
                  </span>
                  <span className="text-[10px] text-ink-500">
                    {conv.lastTimestamp}
                  </span>
                </div>
                <p className="truncate text-[11px] text-ink-500">
                  {conv.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b border-base-700 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-50">
                  {selected.name}
                </p>
                <p className="text-[11px] text-ink-500">
                  {selected.online ? "Online" : "Offline"}
                </p>
              </div>
              <div className="flex gap-2 text-ink-500">
                <Phone className="h-4 w-4" />
                <Video className="h-4 w-4" />
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 text-xs ${
                      msg.from === "me"
                        ? "bg-status-active text-base-950"
                        : "bg-base-800 text-ink-300"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        msg.from === "me" ? "text-base-900" : "text-ink-500"
                      }`}
                    >
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-base-700 p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message"
                className="flex-1 rounded-full border border-base-700 bg-base-900 px-4 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-status-active text-base-950"
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
