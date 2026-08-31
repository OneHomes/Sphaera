"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { type Task } from "@/lib/tasksData";
import { AddTaskModal } from "./AddTaskModal";

const sourceStyles: Record<Task["source"], string> = {
  "User created": "bg-base-700 text-ink-300",
  "Manager assigned": "bg-sky-500/15 text-sky-400",
  "Janus proposed": "bg-violet-500/15 text-violet-400",
  "Stage requirement": "bg-status-alert/15 text-status-alert",
};

export function TasksPage({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [showAddModal, setShowAddModal] = useState(false);

  async function toggleComplete(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: newCompleted,
              dueLabel: newCompleted ? "Completed" : t.dueLabel,
              isOverdue: newCompleted ? false : t.isOverdue,
            }
          : t
      )
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      router.refresh();
    } catch (err) {
      console.error(err);
      router.refresh();
    }
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-ink-50">Tasks</h1>
          <p className="text-sm text-ink-500">
            {pending.length} pending · {completed.length} completed
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
        </button>
      </div>

      <div className="max-w-2xl space-y-2">
        {pending.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
        ))}

        {pending.length === 0 && completed.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-500">
            No tasks yet. Add one to get started.
          </p>
        )}

        {completed.length > 0 && (
          <>
            <p className="pt-4 text-xs font-medium text-ink-500">Completed</p>
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
            ))}
          </>
        )}
      </div>

      {showAddModal && (
        <AddTaskModal onClose={() => setShowAddModal(false)} />
      )}
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