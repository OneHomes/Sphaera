"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { TargetWithProgress } from "@/lib/targetTracker";
import { CreateTargetModal } from "./CreateTargetModal";

function formatValue(metric: string, value: number): string {
  if (metric === "revenue") {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

function progressColor(target: TargetWithProgress): string {
  if (target.percentComplete >= 100) return "bg-status-active";
  if (target.isOnPace) return "bg-status-active";
  return "bg-status-alert";
}

export function TargetsPage({
  targets,
  teams,
  currentUserId,
  canManage,
}: {
  targets: TargetWithProgress[];
  teams: { id: string; name: string }[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this target?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/targets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete target");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-ink-50">Targets</h1>
          <p className="text-sm text-ink-500">
            {targets.length} active target{targets.length === 1 ? "" : "s"}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Set target
          </button>
        )}
      </div>

      <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {targets.map((target) => (
          <div
            key={target.id}
            className="rounded-xl border border-base-700 bg-base-900 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-50">
                {target.scopeLabel} —{" "}
                {target.metric === "revenue"
                  ? "Revenue"
                  : target.metric === "calls"
                    ? "Calls"
                    : "Meetings"}
              </span>
              {canManage && (
                <button
                  onClick={() => handleDelete(target.id)}
                  disabled={deletingId === target.id}
                  className="text-ink-500 hover:text-status-inactive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink-50">
                {formatValue(target.metric, target.actualValue)}
              </span>
              <span className="text-ink-500">
                of {formatValue(target.metric, target.targetValue)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-base-700">
              <div
                className={`h-2 rounded-full ${progressColor(target)}`}
                style={{ width: `${Math.min(target.percentComplete, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              {target.percentComplete}% complete · {target.daysRemaining} days
              left ·{" "}
              <span
                className={
                  target.isOnPace ? "text-status-active" : "text-status-alert"
                }
              >
                {target.isOnPace ? "On pace" : "Behind pace"}
              </span>
            </p>
          </div>
        ))}

        {targets.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-500">
            No active targets right now.
          </p>
        )}
      </div>

      {showCreate && (
        <CreateTargetModal
          teams={teams}
          currentUserId={currentUserId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}