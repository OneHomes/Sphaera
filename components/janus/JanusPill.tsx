"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Mic, PanelsTopLeft, X } from "lucide-react";
import { JanusOrb } from "./JanusOrb";

// Ask-Janus-from-anywhere pill, pinned bottom-centre on every app page.
// Click the orb (or Ctrl/Cmd+J) to open a small chat above it; the mic
// dictates a question and sends it when you stop talking. It uses the
// same /api/janus/ask conversation as the Command Center, which it links
// to for the full view. Hidden on /command, which already is that view.

type Message = { role: "user" | "assistant"; content: string };

// The Web Speech API isn't in TypeScript's DOM lib.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function JanusPill() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Keyboard-opened panels appear instantly: an action repeated many times a
  // day shouldn't make you wait for an animation.
  const [openedByKey, setOpenedByKey] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => setCanDictate(createRecognition() !== null), []);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || isAsking) return;
      setOpen(true);
      setIsAsking(true);
      setError(null);
      setQuery("");
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      try {
        const res = await fetch("/api/janus/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, conversationId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Janus request failed");
        setConversationId(data.conversationId);
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reach Janus right now.");
      } finally {
        setIsAsking(false);
      }
    },
    [conversationId, isAsking]
  );

  // Ctrl/Cmd+J toggles; Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpenedByKey(true);
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, isAsking]);

  function toggleDictation() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setQuery(finalText + interim);
    };
    rec.onend = () => {
      setIsListening(false);
      if (finalText.trim()) void ask(finalText);
    };
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    setOpenedByKey(false);
    setOpen(true);
    setIsListening(true);
    rec.start();
  }

  if (pathname === "/command" || pathname?.startsWith("/command/")) return null;

  const orbState = isListening ? "listening" : isAsking ? "working" : "breathing";

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4"
    >
      {open && (
        <div
          role="dialog"
          aria-label="Ask Janus"
          className={`janus-pill-panel janus-float pointer-events-auto flex max-h-[min(60dvh,520px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-900 shadow-2xl ${
            openedByKey ? "" : "janus-pill-animate"
          }`}
        >
          <div className="flex items-center justify-between border-b border-base-700 px-4 py-2.5">
            <span className="text-sm font-medium text-ink-50">Ask Janus</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-ink-500 transition-colors hover:bg-base-800 hover:text-ink-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={threadRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
            {messages.length === 0 && !isAsking && (
              <p className="text-sm text-ink-500">
                Ask anything about your leads, pipeline or numbers.{" "}
                <span className="text-ink-300">Ctrl+J</span> opens this from any page.
              </p>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={`whitespace-pre-line break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "ml-8 bg-base-800 text-ink-50" : "mr-4 text-ink-300"
                }`}
              >
                {m.content}
              </p>
            ))}
            {isAsking && (
              <div className="flex flex-col items-center gap-3 py-4 text-sm text-ink-500">
                <JanusOrb state="working" size={64} />
                Janus is thinking…
              </div>
            )}
            {error && <p className="text-xs text-status-inactive">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(query);
            }}
            className="flex items-center gap-2 border-t border-base-700 px-3 py-2"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? "Listening…" : messages.length ? "Ask a follow-up…" : "What do you need?"}
              enterKeyHint="send"
              className="w-full bg-transparent py-1.5 text-sm text-ink-50 outline-none placeholder:text-ink-500 focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={!query.trim() || isAsking}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-base-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-base-700 disabled:text-ink-500"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div className="janus-float pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-base-950 p-1 shadow-xl">
        <button
          type="button"
          onClick={() => {
            setOpenedByKey(false);
            setOpen((v) => !v);
          }}
          aria-label={open ? "Close Janus" : "Ask Janus"}
          aria-expanded={open}
          title="Ask Janus (Ctrl+J)"
          className="flex h-9 items-center gap-2 rounded-full px-3 text-sm text-ink-50 transition-colors hover:bg-base-800"
        >
          <JanusOrb state={orbState} />
          <span className="hidden sm:inline">Ask Janus</span>
        </button>
        {canDictate && (
          <button
            type="button"
            onClick={toggleDictation}
            aria-label={isListening ? "Stop dictation" : "Ask Janus by voice"}
            aria-pressed={isListening}
            title={isListening ? "Stop" : "Ask by voice"}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              isListening ? "bg-status-inactive/20 text-status-inactive" : "text-ink-300 hover:bg-base-800 hover:text-ink-50"
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <Link
          href="/command"
          aria-label="Open the Command Center"
          title="Open the Command Center"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-base-800 hover:text-ink-50"
        >
          <PanelsTopLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
