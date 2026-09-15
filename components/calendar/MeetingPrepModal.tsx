"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Sparkles, Video, FileText } from "lucide-react";
import type { GraphCalendarEvent } from "@/lib/graph";

export function MeetingPrepModal({
  event,
  onClose,
}: {
  event: GraphCalendarEvent;
  onClose: () => void;
}) {
  const isPast = new Date(event.end.dateTime) < new Date();

  const [brief, setBrief] = useState<string | null>(null);
  const [matchedLeadId, setMatchedLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isPast);
  const [error, setError] = useState<string | null>(null);

  // Recap is fetched on demand rather than automatically — most past
  // clicks won't have a transcript (recording has to have been turned on
  // live in Teams), so auto-firing this on every click would mostly just
  // produce "no transcript found" noise.
  const [recap, setRecap] = useState<string | null>(null);
  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);

  useEffect(() => {
    if (isPast) return;

    const attendeeEmails =
      event.attendees?.map((a) => a.emailAddress.address) ?? [];

    fetch("/api/janus/meeting-prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: event.subject,
        attendeeEmails,
        startISO: event.start.dateTime,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to prepare meeting brief");
        }
        return res.json();
      })
      .then((data) => {
        setBrief(data.brief);
        setMatchedLeadId(data.matchedLeadId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchRecap() {
    setIsRecapLoading(true);
    setRecapError(null);

    const attendeeEmails =
      event.attendees?.map((a) => a.emailAddress.address) ?? [];

    fetch("/api/janus/meeting-recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        joinUrl: event.onlineMeeting?.joinUrl,
        subject: event.subject,
        attendeeEmails,
        startISO: event.start.dateTime,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to generate meeting recap");
        }
        return res.json();
      })
      .then((data) => {
        setRecap(data.recap);
        setMatchedLeadId(data.matchedLeadId);
      })
      .catch((err) => setRecapError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setIsRecapLoading(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-300" />
            <h2 className="text-sm font-medium text-ink-50">
              {isPast ? "Meeting Recap" : "Meeting Prep"} — {event.subject}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 space-y-1 border-b border-base-700 pb-4 text-xs text-ink-500">
          <p>
            {new Date(event.start.dateTime).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            –{" "}
            {new Date(event.end.dateTime).toLocaleTimeString(undefined, {
              timeStyle: "short",
            })}
          </p>
          {event.organizer && <p>Organizer: {event.organizer.emailAddress.name}</p>}
          {!isPast &&
            (event.onlineMeeting?.joinUrl ? (
              <a
                href={event.onlineMeeting.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-status-active px-3 py-1.5 text-xs font-medium text-base-950 hover:opacity-90"
              >
                <Video className="h-3.5 w-3.5" />
                Join Meeting
              </a>
            ) : (
              <p className="mt-2 text-ink-600">No online meeting link on this event</p>
            ))}
        </div>

        {!isPast && (
          <>
            {isLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-ink-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Janus is preparing your brief…
              </div>
            )}

            {error && <p className="text-xs text-status-inactive">{error}</p>}

            {brief && (
              <>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-300">
                  {brief}
                </p>
                {matchedLeadId && (
                  <Link
                    href={`/leads/${matchedLeadId}`}
                    className="mt-3 inline-block text-xs text-status-active hover:underline"
                  >
                    Open full lead record →
                  </Link>
                )}
              </>
            )}
          </>
        )}

        {isPast && (
          <>
            {!recap && !isRecapLoading && (
              <button
                onClick={fetchRecap}
                className="inline-flex items-center gap-2 rounded-md border border-base-700 px-3 py-1.5 text-xs font-medium text-ink-300 hover:bg-base-800"
              >
                <FileText className="h-3.5 w-3.5" />
                Get Meeting Recap
              </button>
            )}

            {isRecapLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-ink-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching transcript and asking Janus to summarize…
              </div>
            )}

            {recapError && <p className="text-xs text-status-inactive">{recapError}</p>}

            {recap && (
              <>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-300">
                  {recap}
                </p>
                {matchedLeadId && (
                  <Link
                    href={`/leads/${matchedLeadId}`}
                    className="mt-3 inline-block text-xs text-status-active hover:underline"
                  >
                    Open full lead record →
                  </Link>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
