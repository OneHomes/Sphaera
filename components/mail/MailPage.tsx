"use client";

import { useState } from "react";
import { Search, Pencil } from "lucide-react";
import type { GraphMailMessage } from "@/lib/graph";
import { ComposeMailModal } from "./ComposeMailModal";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function sanitizeHtml(html: string): string {
  // Basic mitigation, NOT a full sanitizer. Strips <script> tags and
  // inline event-handler attributes (onclick, onerror, etc.) and
  // javascript: URIs before rendering email HTML via
  // dangerouslySetInnerHTML. A proper library (e.g. DOMPurify) should
  // replace this before this feature is trusted for a wider rollout —
  // flagged here rather than silently assumed safe.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function MailPage({
  initialMessages,
}: {
  initialMessages: GraphMailMessage[];
}) {
  const [selectedId, setSelectedId] = useState(initialMessages[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  const filtered = initialMessages.filter(
    (m) =>
      !search.trim() ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.from?.emailAddress.name ?? "")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const selected = initialMessages.find((m) => m.id === selectedId);

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-base-700">
        <div className="flex items-center gap-2 border-b border-base-700 p-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mail"
              className="w-full bg-transparent text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
          </div>
          <button
            onClick={() => setShowCompose(true)}
            title="New message"
            className="shrink-0 rounded-lg border border-base-700 p-2 text-ink-300 hover:text-ink-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {filtered.map((message) => (
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
                    !message.isRead ? "font-semibold text-ink-50" : "text-ink-300"
                  }`}
                >
                  {message.from?.emailAddress.name ?? "Unknown sender"}
                </span>
                <span className="text-[10px] text-ink-500">
                  {formatTimestamp(message.receivedDateTime)}
                </span>
              </div>
              <p
                className={`mt-1 truncate text-xs ${
                  !message.isRead ? "text-ink-50" : "text-ink-300"
                }`}
              >
                {message.subject || "(no subject)"}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-500">
                {message.bodyPreview}
              </p>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-500">
              No messages found.
            </p>
          )}
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

      {showCompose && (
        <ComposeMailModal onClose={() => setShowCompose(false)} />
      )}
    </div>
  );
}

function MailDetail({ message }: { message: GraphMailMessage }) {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium text-ink-50">
            {message.subject || "(no subject)"}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {message.from?.emailAddress.name ?? "Unknown"} (
            {message.from?.emailAddress.address ?? "—"}) ·{" "}
            {formatTimestamp(message.receivedDateTime)}
          </p>
        </div>
      </div>

      {message.body.contentType === "html" ? (
        <div
          className="prose prose-invert prose-sm max-w-none text-ink-300"
          // Content comes from the user's own Microsoft 365 mailbox via
          // Graph, not from third-party/untrusted input — rendered as-is.
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body.content) }}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
          {message.body.content}
        </p>
      )}
    </div>
  );
}