"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Mic, PanelsTopLeft, X } from "lucide-react";
import { JanusOrb } from "./JanusOrb";

// Ask-Janus-from-anywhere pill, pinned bottom-centre on every app page.
// Click the orb (or Ctrl/Cmd+J) to open a small chat above it; the mic
// dictates a question and sends it when you stop talking. It uses the
// same /api/janus/ask conversation as the Command Center, which it links
// to for the full view. Hidden on /command, which already is that view.
//
// The pill can be tucked away: it is pulled up into a small tab on the top
// edge (a genie going back into its lamp) and pours back down when the tab
// is clicked. Tucked is remembered per browser, and video calls start
// tucked so the pill never sits on the call controls.

const TUCKED_KEY = "sphaera:janus-tucked";

// Genie path from the pill's resting place to the tab: it first squeezes
// sideways, then is drawn up while shrinking to a sliver. Played in reverse
// to pour back out.
function genieFrames(el: HTMLElement): Keyframe[] {
  const r = el.getBoundingClientRect();
  const dy = 14 - (r.top + r.height / 2);
  return [
    { transform: "translateY(0) scale(1, 1)", opacity: 1 },
    { transform: `translateY(${dy * 0.06}px) scale(0.78, 1.1)`, opacity: 1, offset: 0.2 },
    { transform: `translateY(${dy * 0.82}px) scale(0.24, 0.55)`, opacity: 0.9, offset: 0.78 },
    { transform: `translateY(${dy}px) scale(0.08, 0.25)`, opacity: 0 },
  ];
}
const reversed = (frames: Keyframe[]) =>
  frames
    .slice()
    .reverse()
    .map((f) => (typeof f.offset === "number" ? { ...f, offset: 1 - f.offset } : f));
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function rememberTucked(tucked: boolean) {
  try {
    localStorage.setItem(TUCKED_KEY, tucked ? "1" : "0");
  } catch {
    // storage blocked: it just won't be remembered
  }
}

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
  const [tucked, setTucked] = useState(false);
  // Set when the tab is clicked, so the pill pours out once it has mounted.
  const [pourOut, setPourOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const tuckedRef = useRef(false);
  tuckedRef.current = tucked;

  useEffect(() => setCanDictate(createRecognition() !== null), []);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUCKED_KEY) === "1") setTucked(true);
    } catch {
      // storage blocked: start untucked
    }
  }, []);

  // The call screen has its own controls along the bottom.
  useEffect(() => {
    if (pathname?.startsWith("/video/")) setTucked(true);
  }, [pathname]);

  function tuck() {
    setOpen(false);
    rememberTucked(true);
    const el = pillRef.current;
    if (!el) return setTucked(true);
    const anim = prefersReducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease", fill: "forwards" })
      : el.animate(genieFrames(el), { duration: 460, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" });
    anim.onfinish = () => setTucked(true);
  }

  function untuck() {
    rememberTucked(false);
    setPourOut(true);
    setTucked(false);
  }

  useLayoutEffect(() => {
    if (!pourOut || tucked) return;
    setPourOut(false);
    const el = pillRef.current;
    if (!el) return;
    if (prefersReducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease" });
    else el.animate(reversed(genieFrames(el)), { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }, [pourOut, tucked]);

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

  // Ctrl/Cmd+J toggles (and brings a tucked pill back, instantly); Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpenedByKey(true);
        if (tuckedRef.current) {
          rememberTucked(false);
          setTucked(false);
          setOpen(true);
          return;
        }
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

  if (tucked) {
    return (
      <button
        type="button"
        onClick={untuck}
        aria-label="Bring back Ask Janus"
        title="Ask Janus (Ctrl+J)"
        className="janus-tab janus-float fixed left-1/2 top-0 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-b-xl border border-t-0 border-white/10 bg-base-950 py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-ink-300 shadow-lg hover:text-ink-50"
      >
        <JanusOrb state={orbState} />
        Janus
      </button>
    );
  }

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

      <div
        ref={pillRef}
        className="janus-float pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-base-950 p-1 shadow-xl"
      >
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
        <button
          type="button"
          onClick={tuck}
          aria-label="Hide Ask Janus"
          title="Hide (it waits at the top of the screen)"
          className="flex h-9 w-7 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-base-800 hover:text-ink-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
