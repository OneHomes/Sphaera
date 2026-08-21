// Placeholder data only. Real version connects to Google Calendar / M365
// via the embedded-view pattern described in the build spec Section 4.5
// (Embedded Third-Party Apps) — this native week view is a working
// placeholder until that OAuth/API integration exists.

export type CalendarEvent = {
  id: string;
  title: string;
  day: number; // 0 = Sunday .. 6 = Saturday
  startHour: number;
  durationHours: number;
  colorClass: string;
};

export const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayNumbers = [31, 1, 2, 3, 4, 5, 6];
export const hours = Array.from({ length: 10 }, (_, i) => 8 + i); // 8am - 5pm

export const weekEvents: CalendarEvent[] = [
  { id: "e1", title: "Site viewing — Evelyn Hayes", day: 1, startHour: 9, durationHours: 1, colorClass: "bg-status-active/20 border-status-active/40 text-status-active" },
  { id: "e2", title: "Team stand-up", day: 1, startHour: 10, durationHours: 1, colorClass: "bg-sky-500/20 border-sky-500/40 text-sky-400" },
  { id: "e3", title: "Client call — Theodore Vance", day: 1, startHour: 14, durationHours: 1, colorClass: "bg-violet-500/20 border-violet-500/40 text-violet-400" },
  { id: "e4", title: "Meeting prep — Azure Bay", day: 2, startHour: 11, durationHours: 1, colorClass: "bg-status-alert/20 border-status-alert/40 text-status-alert" },
  { id: "e5", title: "Weekly pipeline review", day: 3, startHour: 15, durationHours: 1, colorClass: "bg-sky-500/20 border-sky-500/40 text-sky-400" },
  { id: "e6", title: "Site viewing — Priya Anand", day: 4, startHour: 9, durationHours: 2, colorClass: "bg-status-active/20 border-status-active/40 text-status-active" },
];
