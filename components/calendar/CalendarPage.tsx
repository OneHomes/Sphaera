"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import type { GraphCalendarEvent } from "@/lib/graph";
import { AddEventModal } from "./AddEventModal";
import { MeetingPrepModal } from "./MeetingPrepModal";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Full 24h grid so no event is ever off-grid — we just auto-scroll
// the view to business hours (7am) on open instead of clipping the range.
const hours = Array.from({ length: 24 }, (_, i) => i);
const ROW_HEIGHT = 56;
const DEFAULT_SCROLL_HOUR = 7;

const eventColorClasses = [
  "bg-status-active/20 border-status-active/40 text-status-active",
  "bg-sky-500/20 border-sky-500/40 text-sky-400",
  "bg-violet-500/20 border-violet-500/40 text-violet-400",
  "bg-status-alert/20 border-status-alert/40 text-status-alert",
];

function colorForEvent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % eventColorClasses.length;
  return eventColorClasses[hash];
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function CalendarPage({
  initialEvents,
  weekStartISO,
}: {
  initialEvents: GraphCalendarEvent[];
  weekStartISO: string;
}) {
  const [weekStart, setWeekStart] = useState(new Date(weekStartISO));
  const [events, setEvents] = useState(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prepEvent, setPrepEvent] = useState<GraphCalendarEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-sync from the server whenever the parent Server Component re-renders
  // with fresh data (e.g. after router.refresh() from AddEventModal).
  // Without this, useState(initialEvents) keeps showing the stale first-mount
  // value forever and a manual page reload is the only way to see new events.
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    setWeekStart(new Date(weekStartISO));
  }, [weekStartISO]);

  // Default scroll position: business hours, not the very top of midnight.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * ROW_HEIGHT;
    }
  }, []);

  const dayNumbers = weekDays.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.getDate();
  });

  async function changeWeek(offset: number) {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + offset * 7);
    const newEnd = new Date(newStart);
    newEnd.setDate(newStart.getDate() + 7);

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/calendar?start=${encodeURIComponent(newStart.toISOString())}&end=${encodeURIComponent(newEnd.toISOString())}`
      );
      if (res.ok) {
        setEvents(await res.json());
        setWeekStart(newStart);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function positionFor(event: GraphCalendarEvent) {
    const start = new Date(event.start.dateTime + "Z");
    const end = new Date(event.end.dateTime + "Z");
    const dayIndex = start.getDay();
    const startHour = start.getHours() + start.getMinutes() / 60;
    const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
    return { dayIndex, startHour, durationHours };
  }

  const monthLabel = weekStart.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-base-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Calendar</h1>
          <p className="mt-1 text-sm text-ink-500">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-ink-500" />}
          <button
            onClick={() => changeWeek(-1)}
            disabled={isLoading}
            className="rounded-lg border border-base-700 p-1.5 text-ink-300 hover:text-ink-50 disabled:opacity-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => changeWeek(1)}
            disabled={isLoading}
            className="rounded-lg border border-base-700 p-1.5 text-ink-300 hover:text-ink-50 disabled:opacity-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6">
        <div className="min-w-[700px]">
          <div className="sticky top-0 z-20 grid grid-cols-[60px_repeat(7,1fr)] border-b border-base-700 bg-base-950 pb-2">
            <div />
            {weekDays.map((day, i) => (
              <div key={day} className="text-center">
                <p className="text-[11px] text-ink-500">{day}</p>
                <p className="text-sm text-ink-50">{dayNumbers[i]}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-base-700"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <div className="pr-2 text-right text-[11px] text-ink-500">
                  {formatHourLabel(hour)}
                </div>
                {weekDays.map((_, dayIndex) => (
                  <div key={dayIndex} className="relative border-l border-base-700">
                    {events
                      .map((e) => ({ event: e, pos: positionFor(e) }))
                      .filter(
                        ({ pos }) =>
                          pos.dayIndex === dayIndex &&
                          Math.floor(pos.startHour) === hour
                      )
                      .map(({ event, pos }) => (
                                                <div
                          key={event.id}
                          onClick={() => setPrepEvent(event)}
                          className={`absolute inset-x-1 top-0.5 cursor-pointer rounded border px-1.5 py-1 text-[10px] hover:brightness-110 ${colorForEvent(event.id)}`}
                          style={{
                            height: `${Math.max(pos.durationHours * 56 - 4, 20)}px`,
                            zIndex: 10,
                          }}
                          title={`${event.subject} — click for Janus meeting prep`}
                        >
                          <span className="line-clamp-2">{event.subject}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

           {showAddModal && (
        <AddEventModal onClose={() => setShowAddModal(false)} />
      )}

      {prepEvent && (
        <MeetingPrepModal
          event={prepEvent}
          onClose={() => setPrepEvent(null)}
        />
      )}
    </div>
  );
}