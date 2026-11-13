"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, FileText, Loader2, RefreshCw, Sparkles, Users, Video } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { JanusOrb } from "@/components/janus/JanusOrb";
import type { CallNotes } from "@/lib/video/notes";
import type { RecordingAccess } from "@/lib/video/recordings";

type Props = {
  call: {
    id: string;
    open: boolean;
    startedAt: string;
    endedAt: string | null;
    agentName: string;
    lead: { id: string; name: string } | null;
    guests: { name: string; consentedAt: string }[];
    notesStatus: string | null;
    notes: CallNotes | null;
  };
  recordings: {
    id: string;
    status: string;
    startedAt: string;
    durationSec: number | null;
    sizeBytes: number | null;
    access: RecordingAccess | null;
  }[];
  transcript: { id: string; speakerName: string; speakerRole: string; text: string; spokenAt: string }[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

function offset(iso: string, start: string) {
  const sec = Math.max(0, Math.round((Date.parse(iso) - Date.parse(start)) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// A finished call: recording, Janus's notes and the per-speaker transcript.
export function CallRecord({ call, recordings, transcript }: Props) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Notes and the recording arrive a little after the call ends; check back.
  const waiting =
    !call.open &&
    (call.notesStatus === null || call.notesStatus === "generating" || recordings.some((r) => r.status === "recording"));
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => router.refresh(), 8000);
    const stop = setTimeout(() => clearInterval(t), 10 * 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [waiting, router]);

  async function regenerate() {
    setRegenerating(true);
    setNotesError(null);
    const res = await fetch(`/api/video/calls/${call.id}/notes`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setNotesError(data?.error ?? "Couldn't write the notes");
    else if (data?.notesStatus === "failed") setNotesError("Janus couldn't write notes from this transcript. Try again in a minute.");
    setRegenerating(false);
    router.refresh();
  }

  const callLength = call.endedAt ? Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000) : null;
  const title = call.lead ? `Video call with ${call.lead.name}` : "Video call";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="space-y-1">
        {call.lead && (
          <Link
            href={`/leads/${call.lead.id}`}
            className="inline-flex items-center gap-1 text-xs text-ink-500 transition-colors hover:text-ink-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {call.lead.name}
          </Link>
        )}
        <h1 className="text-xl font-semibold text-ink-50">{title}</h1>
        <p className="text-sm text-ink-500">
          {call.agentName} · {when(call.startedAt)}
          {callLength !== null && ` · ${duration(callLength)}`}
          {call.open && " · in progress"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <WidgetCard title="Recording" icon={Video}>
            <Recordings callId={call.id} open={call.open} recordings={recordings} />
          </WidgetCard>

          <WidgetCard title="Transcript" icon={FileText}>
            {transcript.length === 0 ? (
              <p className="text-sm text-ink-500">
                {call.open ? "Lines appear here as people speak." : "Nothing was transcribed in this call."}
              </p>
            ) : (
              <ol className="max-h-[32rem] space-y-2.5 overflow-y-auto pr-1">
                {transcript.map((s) => (
                  <li key={s.id} className="flex gap-3 text-sm">
                    <span className="w-10 shrink-0 pt-px text-right font-mono text-[11px] tabular-nums text-ink-500">
                      {offset(s.spokenAt, transcript[0].spokenAt)}
                    </span>
                    <p className="min-w-0 flex-1 break-words text-ink-300" dir="auto">
                      <span className={`mr-1.5 font-medium ${s.speakerRole === "client" ? "text-sky-400" : "text-emerald-400"}`}>
                        {s.speakerName}
                      </span>
                      {s.text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </WidgetCard>
        </div>

        <div className="min-w-0 space-y-4">
          <WidgetCard
            title="Janus notes"
            icon={Sparkles}
            action={
              !call.open && transcript.length > 0 && call.notesStatus !== "generating" ? (
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-500 transition-colors hover:text-ink-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                  {call.notes ? "Rewrite" : "Write notes"}
                </button>
              ) : undefined
            }
          >
            <NotesBody call={call} regenerating={regenerating} hasTranscript={transcript.length > 0} />
            {notesError && <p className="mt-2 text-xs text-status-inactive">{notesError}</p>}
          </WidgetCard>

          <WidgetCard title="People" icon={Users}>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-2">
                <span className="truncate text-ink-50">{call.agentName}</span>
                <span className="shrink-0 text-xs text-ink-500">Agent</span>
              </li>
              {call.guests.map((g, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-ink-50">{g.name}</span>
                  <span className="shrink-0 text-xs text-ink-500" title="Agreed to recording and transcription when joining">
                    Consented {new Date(g.consentedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
              {call.guests.length === 0 && <li className="text-xs text-ink-500">The client didn&apos;t join.</li>}
            </ul>
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}

function NotesBody({ call, regenerating, hasTranscript }: { call: Props["call"]; regenerating: boolean; hasTranscript: boolean }) {
  if (call.open) return <p className="text-sm text-ink-500">Janus writes the notes when the call ends.</p>;
  if (regenerating || call.notesStatus === "generating" || (call.notesStatus === null && hasTranscript)) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-ink-300">
        <JanusOrb size={20} />
        Janus is writing the notes…
      </div>
    );
  }
  if (!call.notes) {
    if (call.notesStatus === "failed") return <p className="text-sm text-ink-500">Janus couldn&apos;t write notes for this call.</p>;
    return <p className="text-sm text-ink-500">No notes: nothing was said in this call.</p>;
  }
  const n = call.notes;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-300">{n.summary}</p>
      <NoteList label="Client needs" items={n.clientNeeds} />
      {n.budget && (
        <div>
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">Budget</p>
          <p className="text-ink-300">{n.budget}</p>
        </div>
      )}
      <NoteList label="Concerns" items={n.objections} />
      <NoteList label="Next steps" items={n.nextSteps} />
      {n.nextSteps.length > 0 && <p className="text-xs text-ink-500">Next steps were added to the agent&apos;s tasks.</p>}
    </div>
  );
}

function NoteList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-ink-300 marker:text-ink-500">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function Recordings({ callId, open, recordings }: { callId: string; open: boolean; recordings: Props["recordings"] }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(recordingId: string) {
    setRestoring(recordingId);
    setError(null);
    const res = await fetch(`/api/video/calls/${callId}/recording/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingId }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setError(data?.error ?? "Couldn't request the restore");
    setRestoring(null);
    router.refresh();
  }

  if (recordings.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        {open ? "Recording starts once the agent and the client are both in the call." : "This call wasn't recorded."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((r, i) => {
        const label = recordings.length > 1 ? `Part ${i + 1} · ` : "";
        const meta = [r.durationSec ? duration(r.durationSec) : null, r.sizeBytes ? `${Math.round(r.sizeBytes / 1e6)} MB` : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={r.id} className="space-y-1.5">
            {r.status === "recording" && (
              <p className="flex items-center gap-2 text-sm text-ink-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-status-inactive" />
                {open ? "Recording…" : "Saving the recording…"}
              </p>
            )}
            {r.status === "failed" && <p className="text-sm text-status-inactive">This recording couldn&apos;t be saved.</p>}
            {r.access?.state === "playable" && (
              // No caption track: the transcript below is the text version.
              <video controls preload="metadata" src={r.access.url} className="aspect-video w-full rounded-lg bg-black" />
            )}
            {r.access?.state === "archived" && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-base-700 px-3 py-2.5 text-sm text-ink-300">
                <Archive className="h-4 w-4 shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1">Archived to save cost. Restoring takes a few hours.</span>
                <button
                  type="button"
                  onClick={() => restore(r.id)}
                  disabled={restoring === r.id}
                  className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-50 active:scale-[0.97] disabled:opacity-50"
                >
                  {restoring === r.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  Restore
                </button>
              </div>
            )}
            {r.access?.state === "restoring" && (
              <p className="text-sm text-ink-300">Being restored from the archive. It can be played in a few hours.</p>
            )}
            {r.access?.state === "missing" && <p className="text-sm text-status-inactive">The recording file wasn&apos;t found in storage.</p>}
            {r.access?.state === "not_configured" && (
              <p className="text-sm text-ink-500">Recording storage isn&apos;t connected to Sphaera yet.</p>
            )}
            {(label || meta) && r.status === "ready" && (
              <p className="text-xs text-ink-500">
                {label}
                {meta}
              </p>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-status-inactive">{error}</p>}
    </div>
  );
}
