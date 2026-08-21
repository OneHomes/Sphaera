// Placeholder data only. Real version persists to the Journal Entry
// entity (PRD AE21) — private text stays private per PRD 4.10/19.5,
// never visible to ordinary managers.

export type JournalFolder = "Personal" | "Work" | "Travel" | "Events";

export type JournalNote = {
  id: string;
  folder: JournalFolder;
  title: string;
  date: string;
  preview: string;
  body: string;
};

export const journalFolders: JournalFolder[] = [
  "Personal",
  "Work",
  "Travel",
  "Events",
];

export const journalNotes: JournalNote[] = [
  {
    id: "j1",
    folder: "Work",
    title: "Reflection on this week",
    date: "Today",
    preview: "Strong week overall — closed the Priya Anand deal and...",
    body: "Strong week overall — closed the Priya Anand deal and made good progress on the Evelyn Hayes follow-up. Need to be more consistent with morning call blocks next week; connected call rate was strongest between 10 and 12.",
  },
  {
    id: "j2",
    folder: "Work",
    title: "Notes from team meeting",
    date: "Yesterday",
    preview: "Manager flagged a few coaching points around follow-up...",
    body: "Manager flagged a few coaching points around follow-up timing and encouraged the team to use the WhatsApp channel more for unresponsive email leads.",
  },
  {
    id: "j3",
    folder: "Personal",
    title: "Goals for next month",
    date: "3 days ago",
    preview: "Want to hit Gold tier this quarter, which means...",
    body: "Want to hit Gold tier this quarter, which means keeping the daily mission completion streak going and improving data quality scores.",
  },
];
