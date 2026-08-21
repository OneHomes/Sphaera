"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { lossReasons } from "@/lib/pipelineData";

export function LossReasonModal({
  leadName,
  onConfirm,
  onCancel,
}: {
  leadName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState(lossReasons[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium text-ink-50">
              Mark as Closed Lost
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Select a reason for {leadName} before moving this opportunity.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-ink-500 hover:text-ink-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {lossReasons.map((reason) => (
            <label
              key={reason}
              className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300"
            >
              <input
                type="radio"
                name="lossReason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
                className="accent-status-active"
              />
              {reason}
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedReason)}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
