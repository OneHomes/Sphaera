// Real data now comes from the Task table (see app/(app)/tasks/page.tsx
// and app/api/tasks/) — the mock array that used to live here has been
// removed. This file only holds the shared types.

export type TaskSource =
  | "User created"
  | "Manager assigned"
  | "Janus proposed"
  | "Stage requirement";

export type Task = {
  id: string;
  title: string;
  relatedTo: string;
  dueLabel: string;
  isOverdue: boolean;
  source: TaskSource;
  completed: boolean;
};