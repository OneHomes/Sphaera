const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Microsoft Graph request failed (${res.status}): ${errorBody}`
    );
  }

  // DELETE-style calls and some POSTs return no body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Mail ----

export type GraphMailMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } } | null;
  receivedDateTime: string;
  isRead: boolean;
};

export async function listMailMessages(
  accessToken: string,
  top = 25
): Promise<GraphMailMessage[]> {
  const data = await graphFetch(
    accessToken,
    `/me/messages?$top=${top}&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead&$orderby=receivedDateTime desc`
  );
  return data.value as GraphMailMessage[];
}

export async function sendMail(
  accessToken: string,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<void> {
  await graphFetch(accessToken, `/me/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}

// ---- Calendar ----

export type GraphCalendarEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer: { emailAddress: { name: string; address: string } } | null;
  bodyPreview: string;
};

export async function listCalendarEvents(
  accessToken: string,
  startISO: string,
  endISO: string
): Promise<GraphCalendarEvent[]> {
  // Prefer header forces Graph to return start/end times in UTC rather
  // than the mailbox owner's local timezone (its default) — without
  // this, the frontend's day/hour grid positioning would be wrong for
  // any user whose mailbox isn't already set to UTC.
  const data = await graphFetch(
    accessToken,
    `/me/calendarview?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}&$select=id,subject,start,end,organizer,bodyPreview&$orderby=start/dateTime`,
    { headers: { Prefer: 'outlook.timezone="UTC"' } }
  );
  return data.value as GraphCalendarEvent[];
}

export async function createCalendarEvent(
  accessToken: string,
  subject: string,
  startISO: string,
  endISO: string,
  attendeeEmails?: string[]
): Promise<GraphCalendarEvent> {
  return graphFetch(accessToken, `/me/events`, {
    method: "POST",
    body: JSON.stringify({
      subject,
      start: { dateTime: startISO, timeZone: "UTC" },
      end: { dateTime: endISO, timeZone: "UTC" },
      attendees: (attendeeEmails ?? []).map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    }),
  });
}