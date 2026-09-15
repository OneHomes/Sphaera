// Real data now comes from the JournalEntry table (see
// app/(app)/journal/page.tsx and app/api/journal/) — the mock array that
// used to live here has been removed. journalFolders remains a static
// category list (fixed UI options, not user data).

export type JournalFolder = "Personal" | "Work" | "Travel" | "Events" | "Finances";

export type JournalNote = {
  id: string;
  folder: JournalFolder;
  title: string;
  date: string;
  preview: string;
  body: string;
  isFavorite: boolean;
  archivedAt: string | null;
  deletedAt: string | null;
  updatedAt: string; // ISO — drives Recents ordering
};

export const journalFolders: JournalFolder[] = [
  "Personal",
  "Work",
  "Travel",
  "Events",
  "Finances",
];

// The left-rail "view" a user can be looking at — either a real folder,
// or one of the cross-folder views (Recents/Favorites/Trash/Archived).
export type JournalView = JournalFolder | "Recents" | "Favorites" | "Trash" | "Archived";
