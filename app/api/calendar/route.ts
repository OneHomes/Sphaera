import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCalendarEvents, createCalendarEvent } from "@/lib/graph";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      {
        error:
          "No Microsoft Graph access token on this session. Sign in with Microsoft (not the testing login) to use Calendar.",
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params are required (ISO datetimes)" },
      { status: 400 }
    );
  }

  try {
    const events = await listCalendarEvents(session.accessToken, start, end);
    return NextResponse.json(events);
  } catch (err) {
    console.error("Failed to fetch calendar events:", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events from Microsoft Graph" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "No Microsoft Graph access token on this session." },
      { status: 400 }
    );
  }

  const body = await request.json();
  if (!body.subject || !body.start || !body.end) {
    return NextResponse.json(
      { error: "subject, start, and end are required" },
      { status: 400 }
    );
  }

  // Accept either the old singular field (back-compat) or the new array.
  let attendeeEmails: string[] | undefined;
  if (Array.isArray(body.attendeeEmails)) {
    attendeeEmails = body.attendeeEmails.filter(
      (e: unknown): e is string => typeof e === "string" && e.trim().length > 0
    );
  } else if (typeof body.attendeeEmail === "string" && body.attendeeEmail.trim()) {
    attendeeEmails = [body.attendeeEmail.trim()];
  }
  if (attendeeEmails && attendeeEmails.length === 0) {
    attendeeEmails = undefined;
  }

  try {
    const event = await createCalendarEvent(
      session.accessToken,
      body.subject,
      body.start,
      body.end,
      attendeeEmails
    );
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("Failed to create calendar event:", err);
    return NextResponse.json(
      { error: "Failed to create calendar event via Microsoft Graph" },
      { status: 502 }
    );
  }
}