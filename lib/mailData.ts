// Placeholder data only. Real version connects to Gmail/M365 via the
// embedded-view pattern (build spec Section 4.5) once OAuth/API access
// exists — this native mail UI is a working placeholder until then.

export type EmailMessage = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  unread: boolean;
};

export const inboxMessages: EmailMessage[] = [
  {
    id: "m1",
    sender: "Evelyn Hayes",
    subject: "Re: One Serene Vista — floor plans",
    preview: "Thanks for sending those over, I had a couple of questions about...",
    body: "Thanks for sending those over, I had a couple of questions about the payment schedule for the 2-bed unit. Could we set up a call this week?",
    timestamp: "9:14 AM",
    unread: true,
  },
  {
    id: "m2",
    sender: "Theodore Vance",
    subject: "Meeting confirmed — Azure Bay",
    preview: "Looking forward to it! Just confirming the meeting for...",
    body: "Looking forward to it! Just confirming the meeting for 5:30 PM today at the Azure Bay showroom.",
    timestamp: "8:02 AM",
    unread: true,
  },
  {
    id: "m3",
    sender: "One Homes — Marketing",
    subject: "New campaign assets ready",
    preview: "The updated brochure for Ocean Breeze Residences is now...",
    body: "The updated brochure for Ocean Breeze Residences is now available in the shared drive, along with new pricing sheets.",
    timestamp: "Yesterday",
    unread: false,
  },
  {
    id: "m4",
    sender: "Luna Wright",
    subject: "Question about Downtown Getaway",
    preview: "Is there any flexibility on the studio unit pricing...",
    body: "Is there any flexibility on the studio unit pricing? We're comparing a few options and would love to know before we finalise.",
    timestamp: "Yesterday",
    unread: false,
  },
  {
    id: "m5",
    sender: "Priya Anand",
    subject: "Payment plan finalised",
    preview: "Thank you for working through the payment plan with me...",
    body: "Thank you for working through the payment plan with me — I'm ready to move forward. When can we sign?",
    timestamp: "2 days ago",
    unread: false,
  },
];
