// Real data now comes from the JournalEntry table (see
// app/(app)/journal/page.tsx and app/api/journal/) — the mock array that
// used to live here has been removed. journalFolders remains a static
// category list (fixed UI options, not user data).

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