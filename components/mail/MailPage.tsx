"use client";

import { useState } from "react";
import { Search, Pencil, Reply, Forward } from "lucide-react";
import { inboxMessages, type EmailMessage } from "@/lib/mailData";

export function MailPage() {
  const [selectedId, setSelectedId] = useState(inboxMessages[0]?.id ?? "");
  const selected = inboxMessages.find((m) => m.id === selectedId);

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-base-700">
        <div className="border-b border-base-700 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-500" />
            <input
              placeholder="Search mail"
              className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
          </div>
        </div>
        <div className="overflow-y-auto">
          {inboxMessages.map((message) => (
            <button
              key={message.id}
              onClick={() => setSelectedId(message.id)}
              className={`w-full border-b border-base-700 p-3 text-left transition ${
                selectedId === message.id ? "bg-base-900" : "hover:bg-base-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs ${
                    message.unread ? "font-semibold text-ink-50" : "text-ink-300"
                  }`}
                >
                  {message.sender}
                </span>
                <span className="text-[10px] text-ink-500">
                  {message.timestamp}
                </span>
              </div>
              <p
                className={`mt-1 truncate text-xs ${
                  message.unread ? "text-ink-50" : "text-ink-300"
                }`}
              >
                {message.subject}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-500">
                {message.preview}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <MailDetail message={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Select a message
          </div>
        )}
      </div>
    </div>
  );
}

function MailDetail({ message }: { message: EmailMessage }) {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium text-ink-50">
            {message.subject}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {message.sender} · {message.timestamp}
          </p>
        </div>
        <button className="rounded-lg border border-base-700 p-2 text-ink-300 hover:text-ink-50">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-sm leading-relaxed text-ink-300">{message.body}</p>

      <div className="mt-6 flex gap-2">
        <button className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50">
          <Reply className="h-3.5 w-3.5" />
          Reply
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50">
          <Forward className="h-3.5 w-3.5" />
          Forward
        </button>
      </div>
    </div>
  );
}
