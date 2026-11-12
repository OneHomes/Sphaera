"use client";

import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Check, Copy, Headphones, Link2, PhoneOff } from "lucide-react";
import { confirmDialog } from "@/components/finance/dialogs";
import { linkStorageKey } from "@/lib/video/clientLink";
import { CallSplash } from "./CallSplash";
import { useCoachListener } from "./coachChannel";

// The agent's call screen. The client's link is kept in sessionStorage by
// the button that started the call (the server only stores its hash); if
// it's gone, "New client link" issues another and retires the old one.

export function AgentCall({ callId, leadName }: { callId: string; leadName: string | null }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<{ url: string; call: string; coach: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [connected, setConnected] = useState(false);
  const { coachName } = useCoachListener(tokens?.url ?? null, tokens?.coach ?? null);

  useEffect(() => {
    try {
      setLink(sessionStorage.getItem(linkStorageKey(callId)));
    } catch {
      // storage unavailable: the agent can issue a new link
    }
    fetch(`/api/video/calls/${callId}/agent`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't open the call");
        setTokens(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open the call"));
  }, [callId]);

  async function newLink() {
    if (
      link &&
      !(await confirmDialog("The link you already sent will stop working.", { title: "Issue a new client link?", confirmLabel: "New link" }))
    )
      return;
    const res = await fetch(`/api/video/calls/${callId}/link`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? "Couldn't create a link");
    setLink(data.joinUrl);
    try {
      sessionStorage.setItem(linkStorageKey(callId), data.joinUrl);
    } catch {
      // fine: it's shown on screen
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function endCall() {
    if (!(await confirmDialog("The client will be disconnected and the link will stop working.", { title: "End this call?", confirmLabel: "End call", danger: true }))) return;
    setEnding(true);
    await fetch(`/api/video/calls/${callId}/end`, { method: "POST" }).catch(() => null);
    router.push("/dashboard");
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Over the whole screen while ending, so nothing is clicked mid-hangup. */}
      <CallSplash visible={ending} label="Ending the call…" ending />
      <div className="flex flex-wrap items-center gap-3 border-b border-base-700 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-50" title={leadName ?? undefined}>
            Video call{leadName ? ` with ${leadName}` : ""}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-500">
            <Headphones className="h-3.5 w-3.5 shrink-0" />
            Use headphones, so a manager coaching you can't be heard through your speakers.
          </p>
        </div>
        {coachName && (
          <span className="flex items-center gap-1.5 rounded-full border border-status-active/40 bg-status-active/15 px-2.5 py-1 text-xs font-medium text-status-active">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-active" />
            {coachName} is coaching you
          </span>
        )}
        {link ? (
          <button
            type="button"
            onClick={copyLink}
            title={link}
            className="flex items-center gap-1.5 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy client link"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={newLink}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          New client link
        </button>
        <button
          type="button"
          onClick={endCall}
          disabled={ending}
          className="flex items-center gap-1.5 rounded-lg bg-status-inactive px-2.5 py-1.5 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          End call
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <p className="p-6 text-sm text-status-inactive">{error}</p>
        ) : (
          <>
            <CallSplash visible={!connected} label="Connecting to your call…" />
            {tokens && (
              <LiveKitRoom
                serverUrl={tokens.url}
                token={tokens.call}
                connect
                video
                audio
                data-lk-theme="default"
                style={{ height: "100%" }}
                onConnected={() => setConnected(true)}
                onError={(err) => setError(err.message || "Couldn't connect to the call")}
              >
                <VideoConference />
              </LiveKitRoom>
            )}
          </>
        )}
      </div>
    </div>
  );
}
