"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Pencil, Reply, ReplyAll, Forward, Trash2, Send } from "lucide-react";
import { MAIL_FOLDERS, type GraphMailMessage, type MailFolder } from "@/lib/graph";
import { ComposeMailModal } from "./ComposeMailModal";
import { ForwardMailModal } from "./ForwardMailModal";

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

// "Sent Items" and "Drafts" show recipients ("To:") instead of a sender,
// since the signed-in user authored those messages themselves.
const RECIPIENT_FOLDERS: MailFolder[] = ["sentitems", "drafts"];

export function MailPage({
  initialMessages,
}: {
  initialMessages: GraphMailMessage[];
}) {
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [messages, setMessages] = useState(initialMessages);
  const [folderCounts, setFolderCounts] = useState<Partial<Record<MailFolder, number>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialMessages[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    fetch("/api/mail/folders")
      .then((res) => (res.ok ? res.json() : {}))
      .then(setFolderCounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (folder === "inbox") {
      setMessages(initialMessages);
      setSelectedId(initialMessages[0]?.id ?? "");
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetch(`/api/mail?folder=${folder}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to load messages");
        }
        return res.json() as Promise<GraphMailMessage[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setMessages(data);
        setSelectedId(data[0]?.id ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [folder, initialMessages]);

  function handleDeleted(deletedId: string) {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== deletedId);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  const filtered = messages.filter(
    (m) =>
      !search.trim() ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.from?.emailAddress.name ?? "")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const selected = messages.find((m) => m.id === selectedId);
  const showRecipient = RECIPIENT_FOLDERS.includes(folder);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-80 shrink-0 min-h-0 flex-col border-r border-base-700">
        <div className="shrink-0 space-y-0.5 border-b border-base-700 p-2">
          {MAIL_FOLDERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFolder(f.key)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition ${
                folder === f.key
                  ? "bg-base-800 font-medium text-ink-50"
                  : "text-ink-300 hover:bg-base-900 hover:text-ink-50"
              }`}
            >
              <span>{f.label}</span>
              {folderCounts[f.key] !== undefined && (
                <span className="text-[10px] text-ink-500">
                  {folderCounts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-base-700 p-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && (
            <p className="p-4 text-center text-xs text-ink-500">Loading…</p>
          )}

          {loadError && !isLoading && (
            <p className="p-4 text-center text-xs text-status-inactive">
              {loadError}
            </p>
          )}

          {!isLoading &&
            !loadError &&
            filtered.map((message) => (
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
                    {showRecipient
                      ? `To: ${message.toRecipients?.[0]?.emailAddress.name ?? "Unknown recipient"}`
                      : message.from?.emailAddress.name ?? "Unknown sender"}
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

          {!isLoading && !loadError && filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-500">
              No messages found.
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <MailDetail
            key={selected.id}
            message={selected}
            showRecipient={showRecipient}
            onDeleted={() => handleDeleted(selected.id)}
          />
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

function MailDetail({
  message,
  showRecipient,
  onDeleted,
}: {
  message: GraphMailMessage;
  showRecipient: boolean;
  onDeleted: () => void;
}) {
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replyBoxRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to (and focus) the reply box the moment Reply/Reply All
  // is clicked — without this, a long email body pushes the reply box
  // below the fold and the user has to manually scroll down to find it.
  useEffect(() => {
    if (replyMode) {
      replyBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      // Small delay so focus happens after the scroll starts, rather
      // than fighting it (focus alone can jump the viewport instantly).
      const timer = setTimeout(() => replyTextareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [replyMode]);

  const recipientLine = showRecipient
    ? `To: ${
        message.toRecipients?.map((r) => r.emailAddress.name).join(", ") ??
        "Unknown recipient"
      }`
    : `${message.from?.emailAddress.name ?? "Unknown"} (${
        message.from?.emailAddress.address ?? "—"
      })`;

  async function handleSendReply() {
    if (!replyMode) return;
    setIsSendingReply(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail/${message.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: replyMode, comment: replyText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send reply");
      }
      setReplySent(true);
      setReplyMode(null);
      setReplyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this message?")) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail/${message.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete message");
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
      setIsDeleting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-ink-50">
            {message.subject || "(no subject)"}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {recipientLine} · {formatTimestamp(message.receivedDateTime)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              setReplyMode("reply");
              setReplySent(false);
            }}
            title="Reply"
            className="rounded-lg border border-base-700 p-2 text-ink-300 hover:text-ink-50"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setReplyMode("replyAll");
              setReplySent(false);
            }}
            title="Reply all"
            className="rounded-lg border border-base-700 p-2 text-ink-300 hover:text-ink-50"
          >
            <ReplyAll className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowForward(true)}
            title="Forward"
            className="rounded-lg border border-base-700 p-2 text-ink-300 hover:text-ink-50"
          >
            <Forward className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete"
            className="rounded-lg border border-base-700 p-2 text-ink-300 hover:text-status-inactive disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {message.body.contentType === "html" ? (
        <div className="max-w-3xl overflow-hidden rounded-lg border border-base-700 bg-white">
          <div
            className="prose prose-sm max-w-none p-4 text-black"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(message.body.content),
            }}
          />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
          {message.body.content}
        </p>
      )}

      {error && <p className="mt-3 text-xs text-status-inactive">{error}</p>}

      {replySent && (
        <p className="mt-3 text-xs text-status-active">Reply sent.</p>
      )}

      {replyMode && (
        <div
          ref={replyBoxRef}
          className="mt-4 max-w-3xl rounded-lg border border-base-700 bg-base-900 p-3"
        >
          <p className="mb-2 text-xs text-ink-500">
            {replyMode === "reply" ? "Reply" : "Reply all"} to{" "}
            {message.from?.emailAddress.name ?? "sender"}
          </p>
          <textarea
            ref={replyTextareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write your reply…"
            rows={4}
            className="w-full resize-none rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setReplyMode(null)}
              className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReply}
              disabled={isSendingReply}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
            >
              <Send className="h-3 w-3" />
              {isSendingReply ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {showForward && (
        <ForwardMailModal
          messageId={message.id}
          subject={message.subject}
          onClose={() => setShowForward(false)}
          onSent={() => {}}
        />
      )}
    </div>
  );
}