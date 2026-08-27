import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCalendarEvents, type GraphCalendarEvent } from "@/lib/graph";
import { CalendarPage as CalendarPageComponent } from "@/components/calendar/CalendarPage";

export const dynamic = "force-dynamic";

function getWeekBounds(offsetWeeks: number) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export default async function CalendarRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  if (!session.accessToken) {
    return (
      <div className="p-6 text-sm text-ink-500">
        Calendar requires signing in with Microsoft. The testing
        email/password login doesn&apos;t grant Microsoft Graph access.
      </div>
    );
  }

  const { start, end } = getWeekBounds(0);
  let events: GraphCalendarEvent[] = [];
  let error: string | null = null;

  try {
    events = await listCalendarEvents(
      session.accessToken,
      start.toISOString(),
      end.toISOString()
    );
  } catch (err) {
    error =
      "Couldn't load calendar events from Microsoft Graph. Try signing out and back in.";
    console.error(err);
  }

  if (error) {
    return <div className="p-6 text-sm text-status-inactive">{error}</div>;
  }

  return <CalendarPageComponent initialEvents={events} weekStartISO={start.toISOString()} />;
}