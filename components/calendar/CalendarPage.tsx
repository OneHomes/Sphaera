"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { weekDays, dayNumbers, hours, weekEvents } from "@/lib/calendarData";

export function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-base-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Calendar</h1>
          <p className="mt-1 text-sm text-ink-500">Dec 2023 · Jan 2024</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg border border-base-700 p-1.5 text-ink-300 hover:text-ink-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-lg border border-base-700 p-1.5 text-ink-300 hover:text-ink-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white">
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-base-700 pb-2">
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
                style={{ height: "56px" }}
              >
                <div className="pr-2 text-right text-[11px] text-ink-500">
                  {hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                </div>
                {weekDays.map((_, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="relative border-l border-base-700"
                  >
                    {weekEvents
                      .filter(
                        (e) => e.day === dayIndex && e.startHour === hour
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`absolute inset-x-1 top-0.5 rounded border px-1.5 py-1 text-[10px] ${event.colorClass}`}
                          style={{
                            height: `${event.durationHours * 56 - 4}px`,
                            zIndex: 10,
                          }}
                          title={event.title}
                        >
                          <span className="line-clamp-2">{event.title}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
