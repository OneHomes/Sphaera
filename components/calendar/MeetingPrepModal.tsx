"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Sparkles } from "lucide-react";
import type { GraphCalendarEvent } from "@/lib/graph";

export function MeetingPrepModal({
  event,
  onClose,
}: {
  event: GraphCalendarEvent;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [matchedLeadId, setMatchedLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-300" />
            <h2 className="text-sm font-medium text-ink-50">
              Meeting Prep — {event.subject}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

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
      </div>
    </div>
  );
}