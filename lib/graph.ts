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

// Transcript content comes back as plain VTT text, not JSON — needs its
// own fetch that doesn't try to JSON.parse the response body.
async function graphFetchText(
  accessToken: string,
  path: string,
  accept?: string
): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(accept ? { Accept: accept } : {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Microsoft Graph request failed (${res.status}): ${errorBody}`
    );
  }

  return res.text();
}

// ---- Mail ----

export type GraphMailMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } } | null;
  toRecipients?: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  isRead: boolean;
};

// Well-known Microsoft Graph mail folder names — using these directly in
// the URL path (instead of a folder's opaque id) works for every
// mailbox without an extra lookup call. "notes" is included because it
// was requested in the UI, but note it is NOT a standard well-known
// Graph mail folder for most Exchange Online mailboxes (it's a legacy
// Outlook concept) — requests for it may 404 depending on the mailbox.
// Both listMailMessages and getMailFolderCounts handle that per-folder
// failure gracefully rather than breaking the whole page.
export type MailFolder =
  | "inbox"
  | "drafts"
  | "sentitems"
  | "deleteditems"
  | "junkemail"
  | "notes"
  | "archive";

export const MAIL_FOLDERS: { key: MailFolder; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "drafts", label: "Drafts" },
  { key: "sentitems", label: "Sent Items" },
  { key: "deleteditems", label: "Deleted Items" },
  { key: "junkemail", label: "Junk Email" },
  { key: "notes", label: "Notes" },
  { key: "archive", label: "Archive" },
];

export async function listMailMessages(
  accessToken: string,
  top = 25,
  folder: MailFolder = "inbox"
): Promise<GraphMailMessage[]> {
  const data = await graphFetch(
    accessToken,
    `/me/mailFolders/${folder}/messages?$top=${top}&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead&$orderby=receivedDateTime desc`
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

// Fetches item counts for the sidebar folder list (e.g. "Inbox: 295").
// Each folder is requested independently via Promise.allSettled so one
// missing/blocked folder (e.g. "notes" not existing on this mailbox)
// doesn't take down the whole sidebar — that folder just shows no count.
export async function getMailFolderCounts(
  accessToken: string
): Promise<Partial<Record<MailFolder, number>>> {
  const results = await Promise.allSettled(
    MAIL_FOLDERS.map(async ({ key }) => {
      const data = await graphFetch(
        accessToken,
        `/me/mailFolders/${key}?$select=totalItemCount`
      );
      return { key, count: data.totalItemCount as number };
    })
  );

  const counts: Partial<Record<MailFolder, number>> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      counts[result.value.key] = result.value.count;
    }
  }
  return counts;
}

// ---- Calendar ----

export type GraphCalendarEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer: { emailAddress: { name: string; address: string } } | null;
  attendees?: { emailAddress: { name: string; address: string } }[];
  bodyPreview: string;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl: string } | null;
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
       `/me/calendarview?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}&$select=id,subject,start,end,organizer,attendees,bodyPreview,isOnlineMeeting,onlineMeeting&$orderby=start/dateTime`,
    { headers: { Prefer: 'outlook.timezone="UTC"' } }
  );
  return data.value as GraphCalendarEvent[];
}
export async function replyToMessage(
  accessToken: string,
  messageId: string,
  comment: string,
  replyAll: boolean
): Promise<void> {
  const endpoint = replyAll ? "replyAll" : "reply";
  await graphFetch(accessToken, `/me/messages/${messageId}/${endpoint}`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function forwardMessage(
  accessToken: string,
  messageId: string,
  toEmail: string,
  comment: string
): Promise<void> {
  await graphFetch(accessToken, `/me/messages/${messageId}/forward`, {
    method: "POST",
    body: JSON.stringify({
      comment,
      toRecipients: [{ emailAddress: { address: toEmail } }],
    }),
  });
}

export async function deleteMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  await graphFetch(accessToken, `/me/messages/${messageId}`, {
    method: "DELETE",
  });
}
// ---- Meeting transcripts ----
//
// Teams only generates a transcript if recording/transcription was
// turned on during the actual call — this can't be triggered remotely,
// it's whatever happened live in Teams. Requires the delegated
// OnlineMeetingTranscript.Read.All scope (see lib/auth.ts) AND the
// tenant's Teams Admin Center "Transcript API access" toggle to be on;
// without either, Graph returns 403 GraphAccessToTranscriptsDisabled.

export type GraphTranscript = {
  id: string;
  transcriptContentUrl: string;
};

// Resolves a calendar event's Teams joinUrl to the internal online
// meeting id the transcripts endpoint actually needs — they're not the
// same identifier.
export async function getOnlineMeetingIdFromJoinUrl(
  accessToken: string,
  joinUrl: string
): Promise<string | null> {
  const data = await graphFetch(
    accessToken,
    `/me/onlineMeetings?$filter=JoinWebUrl eq '${encodeURIComponent(joinUrl)}'`
  );
  return data?.value?.[0]?.id ?? null;
}

export async function listMeetingTranscripts(
  accessToken: string,
  onlineMeetingId: string
): Promise<GraphTranscript[]> {
  const data = await graphFetch(
    accessToken,
    `/me/onlineMeetings/${onlineMeetingId}/transcripts`
  );
  return (data?.value as GraphTranscript[]) ?? [];
}

// Content comes back as WebVTT (timestamped caption format), not plain
// prose — fine to feed straight into Janus for summarization, but not
// meant to be shown to a user verbatim.
//
// Requesting speaker-attributed VTT ($format=text/vtt) 403s with
// SpeakerAttributionNotAllowed on tenants that have that setting
// disabled — Graph's own error tells you to retry with this Accept
// header instead, which returns plain (non-speaker-attributed) text.
export async function getTranscriptContentVtt(
  accessToken: string,
  onlineMeetingId: string,
  transcriptId: string
): Promise<string> {
  try {
    return await graphFetchText(
      accessToken,
      `/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("SpeakerAttributionNotAllowed")) throw err;

    return graphFetchText(
      accessToken,
      `/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content`,
      "application/vnd.microsoft.graph.transcript+text"
    );
  }
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
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    }),
  });
}