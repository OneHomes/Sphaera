"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, CalendarPlus, Plus, Trash2 } from "lucide-react";

export function AddEventModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationHours, setDurationHours] = useState(1);
  const [attendees, setAttendees] = useState<string[]>([""]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAttendee(index: number, value: string) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  function addAttendeeField() {
    setAttendees((prev) => [...prev, ""]);
  }

  function removeAttendeeField(index: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !date) {
      setError("Subject and date are required.");
      return;
    }

    const attendeeEmails = attendees
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = attendeeEmails.find((a) => !emailPattern.test(a));
    if (invalid) {
      setError(`"${invalid}" doesn't look like a valid email.`);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          start: start.toISOString(),
          end: end.toISOString(),
          attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create event");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Add event</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Event title"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
            />
          </div>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            <option value={0.5}>30 minutes</option>
            <option value={1}>1 hour</option>
            <option value={1.5}>1.5 hours</option>
            <option value={2}>2 hours</option>
          </select>

          <div className="space-y-2">
            <p className="text-[11px] text-ink-500">Attendees (optional)</p>
            {attendees.map((email, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => updateAttendee(index, e.target.value)}
                  placeholder="attendee@onehomes.com"
                  className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
                />
                {attendees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAttendeeField(index)}
                    className="rounded-lg border border-base-700 px-2 text-ink-500 hover:text-status-inactive"
                    aria-label="Remove attendee"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addAttendeeField}
              className="flex items-center gap-1 text-[11px] text-ink-300 hover:text-ink-50"
            >
              <Plus className="h-3 w-3" />
              Add another attendee
            </button>
          </div>

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : "Add event"}
          </button>
        </form>
      </div>
    </div>
  );
}