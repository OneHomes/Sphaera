// Placeholder data only. Real version reads from the Task entity
// (PRD AE14 — task sources: user created, manager assigned, Janus
// proposed, conversation generated, rule generated, stage requirement).

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

export const initialTasks: Task[] = [
  { id: "tk1", title: "Call back Evelyn Hayes", relatedTo: "Evelyn Hayes", dueLabel: "Today, 3:00 PM", isOverdue: false, source: "Janus proposed", completed: false },
  { id: "tk2", title: "Prepare meeting brief for Azure Bay", relatedTo: "Theodore Vance", dueLabel: "Today, 5:00 PM", isOverdue: false, source: "Stage requirement", completed: false },
  { id: "tk3", title: "First contact call — Hazel Wright", relatedTo: "Hazel Wright", dueLabel: "Overdue", isOverdue: true, source: "Janus proposed", completed: false },
  { id: "tk4", title: "Send updated brochure", relatedTo: "Scarlett Hayes", dueLabel: "Today, 7:00 PM", isOverdue: false, source: "User created", completed: false },
  { id: "tk5", title: "Follow up on payment plan", relatedTo: "Priya Anand", dueLabel: "Tomorrow, 10:00 AM", isOverdue: false, source: "Manager assigned", completed: false },
  { id: "tk6", title: "Confirm site viewing", relatedTo: "Evelyn Hayes", dueLabel: "Completed yesterday", isOverdue: false, source: "User created", completed: true },
];
