"use client";

import "@livekit/components-styles";
import { useCallback, useEffect, useState } from "react";
import { GridLayout, LiveKitRoom, ParticipantTile, RoomAudioRenderer, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Eye, Loader2, Mic, PhoneOff, Video, X } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { confirmDialog } from "@/components/finance/dialogs";
import { useCoachTalker } from "./coachChannel";

type LiveCall = {
  id: string;
  agentName: string;
  leadName: string | null;
  createdAt: string;
  participants: { name: string; role: "agent" | "client"; joinedAt: number }[];
};

// Admin: every open call, and an unseen monitor for any of them.
export function LiveCalls() {
  const [calls, setCalls] = useState<LiveCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState<LiveCall | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/video/live").catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setError(data?.error ?? "Couldn't load live calls");
    setError(null);
    setCalls(data);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (monitoring) return <MonitorView call={monitoring} onClose={() => setMonitoring(null)} />;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-50">Live calls</h1>
      <WidgetCard title="Video calls right now" icon={Video}>
        {error && <p className="text-sm text-status-inactive">{error}</p>}
        {!calls && !error && (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {calls?.length === 0 && <p className="text-sm text-ink-500">No calls are open right now.</p>}
        {calls && calls.length > 0 && (
          <ul className="divide-y divide-base-700">
            {calls.map((c) => {
              const client = c.participants.find((p) => p.role === "client");
              const live = c.participants.length > 0;
              return (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-status-active" : "bg-base-600"}`}
                    title={live ? "In progress" : "Waiting for people to join"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-50" title={c.agentName}>
                      {c.agentName}
                      <span className="text-ink-500"> with </span>
                      {client?.name ?? c.leadName ?? "client (not joined yet)"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {live ? `${c.participants.length} in call` : "Waiting"} · started{" "}
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonitoring(c)}
                    disabled={!live}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Monitor
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </WidgetCard>
      <p className="mt-3 text-xs text-ink-500">
        Monitoring is invisible to the agent and the client. Talking reaches the agent only. Every monitoring session is
        recorded in the audit log.
      </p>
    </div>
  );
}

function MonitorView({ call, onClose }: { call: LiveCall; onClose: () => void }) {
  const [tokens, setTokens] = useState<{ url: string; call: string; coach: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const coach = useCoachTalker(tokens?.url ?? null, tokens?.coach ?? null);

  useEffect(() => {
    fetch(`/api/video/calls/${call.id}/monitor`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't open the call");
        setTokens(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open the call"));
  }, [call.id]);

  async function endForEveryone() {
    if (!(await confirmDialog("End this call for the agent and the client?", { title: "End call", confirmLabel: "End call", danger: true }))) return;
    await fetch(`/api/video/calls/${call.id}/end`, { method: "POST" }).catch(() => null);
    onClose();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-base-700 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-50">
            Monitoring {call.agentName}
            {call.leadName ? ` with ${call.leadName}` : ""}
          </p>
          <p className="text-xs text-ink-500">Nobody in the call can see or hear you.</p>
        </div>
        <button
          type="button"
          // Push to talk: the microphone is on only while held.
          onPointerDown={coach.startTalking}
          onPointerUp={coach.stopTalking}
          onPointerLeave={() => coach.talking && coach.stopTalking()}
          disabled={!coach.ready}
          className={`flex select-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
            coach.talking ? "bg-status-active text-white" : "border border-base-700 text-ink-300 hover:text-ink-50"
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          {coach.talking ? "Talking to agent…" : "Hold to talk to agent"}
        </button>
        <button
          type="button"
          onClick={endForEveryone}
          className="flex items-center gap-1.5 rounded-lg border border-status-inactive/40 px-2.5 py-1.5 text-xs text-status-inactive transition-colors hover:bg-status-inactive/10"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          End call
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stop monitoring"
          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-base-800 hover:text-ink-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {coach.error && <p className="px-4 pt-2 text-xs text-status-inactive">{coach.error}</p>}
      <div className="min-h-0 flex-1">
        {error ? (
          <p className="p-6 text-sm text-status-inactive">{error}</p>
        ) : !tokens ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Joining unseen…
          </div>
        ) : (
          // Hidden and subscribe-only: no camera or microphone is ever published here.
          <LiveKitRoom serverUrl={tokens.url} token={tokens.call} connect video={false} audio={false} data-lk-theme="default" style={{ height: "100%" }}>
            <MonitorGrid />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

function MonitorGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  ).filter((t) => !t.participant.isLocal);

  if (tracks.length === 0) {
    return <p className="p-6 text-sm text-ink-500">Nobody is in the call right now.</p>;
  }
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}
