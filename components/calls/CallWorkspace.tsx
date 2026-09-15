"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Sparkles,
  UserCog,
  Loader2,
  Send,
  ArrowRight,
  Info,
} from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { JanusGlyph } from "@/components/janus/JanusGlyph";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallWorkspace({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"active" | "ending" | "ended">("active");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);

  const [tip, setTip] = useState<string | null>(null);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);

  const [assistStatus, setAssistStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const [draft, setDraft] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState<"idle" | "sending" | "sent">("idle");

  const finalDurationRef = useRef(0);

  useEffect(() => {
    if (phase !== "active") return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  async function requestJanusTip() {
    setIsTipLoading(true);
    setTipError(null);
    try {
      const res = await fetch("/api/janus/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "leadId",
          leadId: lead.id,
          question:
            "I'm on a live call with this lead right now. Give me one specific, short talking point or objection response I can use in the next few seconds.",
        }),
      });
      if (!res.ok) throw new Error("Janus couldn't respond right now.");
      const data = await res.json();
      setTip(data.answer);
    } catch (err) {
      setTipError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsTipLoading(false);
    }
  }

  async function requestManagerAssist() {
    setAssistStatus("sending");
    try {
      const res = await fetch(`/api/leads/${lead.id}/request-assistance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: `Live call, ${formatDuration(elapsedSeconds)} in` }),
      });
      if (!res.ok) throw new Error();
      setAssistStatus("sent");
    } catch {
      setAssistStatus("error");
    }
  }

  async function handleEndCall() {
    finalDurationRef.current = elapsedSeconds;
    setPhase("ending");

    try {
      await fetch(`/api/leads/${lead.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "call",
          summary: `Call with ${lead.name}, duration ${formatDuration(finalDurationRef.current)}`,
        }),
      });
    } catch (err) {
      console.error("Failed to log call:", err);
    }

    setPhase("ended");
    fetchFollowUpDraft();
  }

  async function fetchFollowUpDraft() {
    setIsDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/janus/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          objective: "A short post-call follow-up thanking them for their time and referencing the call.",
        }),
      });
      if (!res.ok) throw new Error("Janus couldn't draft a follow-up right now.");
      const data = await res.json();
      setDraft(data.draft);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleLogFollowUp() {
    if (!draft.trim()) return;
    setFollowUpStatus("sending");
    try {
      await fetch(`/api/leads/${lead.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", summary: draft.trim() }),
      });
      setFollowUpStatus("sent");
    } catch {
      setFollowUpStatus("idle");
    }
  }

  if (phase === "ended") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5 text-center">
          <p className="text-2xl font-semibold text-ink-50">
            {formatDuration(finalDurationRef.current)}
          </p>
          <p className="mt-1 text-sm text-ink-500">Call has ended</p>
          <p className="mt-4 text-xs font-medium text-ink-300">Next steps according to Janus</p>

          <div className="mt-2 rounded-lg border border-base-700 bg-base-800 p-3 text-left">
            {isDrafting ? (
              <div className="flex items-center gap-2 py-4 text-xs text-ink-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Drafting a follow-up…
              </div>
            ) : draftError ? (
              <p className="text-xs text-status-inactive">{draftError}</p>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="w-full resize-none bg-transparent text-xs leading-relaxed text-ink-300 outline-none"
              />
            )}
          </div>

          {followUpStatus === "sent" ? (
            <p className="mt-4 rounded-lg border border-status-active/30 bg-status-active/10 py-2 text-xs text-status-active">
              Follow-up logged
            </p>
          ) : (
            <button
              onClick={handleLogFollowUp}
              disabled={isDrafting || !draft.trim() || followUpStatus === "sending"}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {followUpStatus === "sending" ? "Logging…" : "Log follow-up as sent"}
            </button>
          )}
        </div>

        <button
          onClick={() => router.push("/calls")}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-900 px-4 py-2 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
        >
          Jump to the next call
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col rounded-xl border border-base-700 bg-base-900 p-4">
        <p className="text-xs text-ink-500">{lead.name}</p>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-base-800">
            <User className="h-10 w-10 text-ink-500" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 pb-2">
          <button
            onClick={() => setSpeakerOn((v) => !v)}
            className="flex flex-col items-center gap-1 text-[10px] text-ink-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-base-800">
              {speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </span>
            Speaker
          </button>
          <button
            onClick={() => setIsMuted((v) => !v)}
            className="flex flex-col items-center gap-1 text-[10px] text-ink-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-base-800">
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </span>
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={handleEndCall}
            disabled={phase === "ending"}
            className="flex flex-col items-center gap-1 text-[10px] text-ink-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-status-inactive text-white">
              <PhoneOff className="h-4 w-4" />
            </span>
            End
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-base-700 bg-base-900 p-3">
          <p className="text-2xl font-semibold text-ink-50">{formatDuration(elapsedSeconds)}</p>
          <p className="text-[11px] text-ink-500">Duration</p>
        </div>

        <div className="rounded-lg border border-status-alert/30 bg-status-alert/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-status-alert">
            <Info className="h-3 w-3" />
            Live call intelligence
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
            Sentiment, tonality, and keyword detection require a connected
            telephony/voice-analytics provider. One Homes uses Lexatail —
            confirmed as the real provider, but deliberately not wired up
            yet (still in the data audit phase; integration deferred until
            the audit hands off connection details).
          </p>
        </div>

        <div className="rounded-lg border border-base-700 bg-base-900 p-3">
          <button
            onClick={requestJanusTip}
            disabled={isTipLoading}
            className="flex w-full items-center gap-2 text-left text-xs font-medium text-ink-50"
          >
            <JanusGlyph className="h-4 w-4 text-white" />
            Sphaera Assistance
          </button>
          {isTipLoading && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking…
            </div>
          )}
          {tipError && <p className="mt-2 text-[11px] text-status-inactive">{tipError}</p>}
          {tip && <p className="mt-2 text-[11px] leading-relaxed text-ink-300">{tip}</p>}
          {!tip && !isTipLoading && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-500">
              <Sparkles className="h-2.5 w-2.5" />
              Tap for a real-time talking point
            </p>
          )}
        </div>

        <div className="rounded-lg border border-base-700 bg-base-900 p-3">
          <button
            onClick={requestManagerAssist}
            disabled={assistStatus === "sending" || assistStatus === "sent"}
            className="flex w-full items-center gap-2 text-left text-xs font-medium text-ink-50 disabled:opacity-70"
          >
            <UserCog className="h-4 w-4 text-ink-300" />
            Manager Assistance
          </button>
          {assistStatus === "sent" && (
            <p className="mt-2 text-[11px] text-status-active">Your manager has been notified.</p>
          )}
          {assistStatus === "error" && (
            <p className="mt-2 text-[11px] text-status-inactive">
              Couldn&apos;t reach a manager — no manager assigned to your team.
            </p>
          )}
          {assistStatus === "idle" && (
            <p className="mt-1 text-[10px] text-ink-500">Notifies your manager to step in</p>
          )}
        </div>
      </div>
    </div>
  );
}
