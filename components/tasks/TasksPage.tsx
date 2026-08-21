"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { initialTasks, type Task } from "@/lib/tasksData";

const sourceStyles: Record<Task["source"], string> = {
  "User created": "bg-base-700 text-ink-300",
  "Manager assigned": "bg-sky-500/15 text-sky-400",
  "Janus proposed": "bg-violet-500/15 text-violet-400",
  "Stage requirement": "bg-status-alert/15 text-status-alert",
};

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  function toggleComplete(id: string) {
    // TODO: persist to the Task entity once a backend exists; completion
    // should also update mission/lead status and AEX score per AE14.
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">Tasks</h1>
      <p className="mb-5 text-sm text-ink-500">
        {pending.length} pending · {completed.length} completed
      </p>

      <div className="max-w-2xl space-y-2">
        {pending.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
        ))}

        {completed.length > 0 && (
          <>
            <p className="pt-4 text-xs font-medium text-ink-500">Completed</p>
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-base-700 bg-base-900 p-3 ${
        task.completed ? "opacity-50" : ""
      }`}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          task.completed
            ? "border-status-active bg-status-active text-base-950"
            : "border-base-600"
        }`}
      >
        {task.completed && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            task.completed ? "text-ink-500 line-through" : "text-ink-50"
          }`}
        >
          {task.title}
        </p>
        <p className="text-xs text-ink-500">{task.relatedTo}</p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceStyles[task.source]}`}
      >
        {task.source}
      </span>
      <span
        className={`w-28 shrink-0 text-right text-xs ${
          task.isOverdue ? "text-status-inactive" : "text-ink-500"
        }`}
      >
        {task.dueLabel}
      </span>
    </div>
  );
}
