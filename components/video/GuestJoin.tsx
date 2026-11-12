"use client";

import "@livekit/components-styles";
import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Loader2, Video } from "lucide-react";
import { SphaeraWordmark } from "@/components/brand/SphaeraWordmark";
import { CallSplash } from "./CallSplash";

// The client's side of a video call: opened from the link the agent sent,
// in any browser, with no account. Joining requires accepting that the call
// may be monitored and recorded; the server refuses a join without it.
export function GuestJoin({ callId, joinKey, agentName, orgName }: { callId: string; joinKey: string; agentName: string; orgName: string }) {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ url: string; call: string } | null>(null);
  const [left, setLeft] = useState(false);
  const [connected, setConnected] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/video/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, key: joinKey, name, consent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't join the call");
      setSession({ url: data.url, call: data.call });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the call");
    } finally {
      setJoining(false);
    }
  }

  if (left) {
    return (
      <Centered>
        <p className="text-lg font-medium text-ink-50">You left the call.</p>
        <p className="mt-1 text-sm text-ink-300">You can close this window.</p>
      </Centered>
    );
  }

  if (session) {
    return (
      <div className="relative h-dvh">
        <CallSplash visible={!connected} label={`Connecting you to ${agentName}…`} />
        <LiveKitRoom
          serverUrl={session.url}
          token={session.call}
          connect
          video
          audio
          data-lk-theme="default"
          style={{ height: "100%" }}
          onConnected={() => setConnected(true)}
          onDisconnected={() => setLeft(true)}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <Centered>
      <SphaeraWordmark className="h-8 text-ink-50" />
      <h1 className="mt-8 text-2xl font-semibold text-ink-50">Join your video call</h1>
      <p className="mt-1 text-sm text-ink-300">
        with {agentName} · {orgName}
      </p>
      <form onSubmit={join} className="mt-6 flex w-full flex-col gap-3 text-left">
        <label className="text-xs text-ink-300" htmlFor="guest-name">
          Your name
        </label>
        <input
          id="guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
          required
          className="w-full rounded-lg border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-500 focus:border-status-active focus:outline-none"
          placeholder="e.g. Ayesha Khan"
        />
        <label className="mt-2 flex items-start gap-2.5 text-sm leading-snug text-ink-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--status-active))]"
          />
          I understand this call may be monitored and recorded for quality and training purposes.
        </label>
        {error && <p className="text-xs text-status-inactive">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim() || !consent || joining}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-status-active py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          Join call
        </button>
        <p className="text-center text-xs text-ink-500">Your browser will ask to use your camera and microphone.</p>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </main>
  );
}
