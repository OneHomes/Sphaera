"use client";

import { useState } from "react";
import { X, Phone, Mail, CalendarClock } from "lucide-react";

const TYPES = [
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: CalendarClock },
] as const;

type InteractionType = (typeof TYPES)[number]["value"];

export function LogInteractionModal({
  leadId,
  defaultType,
  onClose,
  onLogged,
}: {
  leadId: string;
  defaultType: InteractionType;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [type, setType] = useState<InteractionType>(defaultType);
  const [summary, setSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) {
      setError("A short summary is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, summary }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to log interaction");
      }
      onLogged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Log interaction</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            {TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition ${
                  type === value
                    ? "border-status-active bg-status-active/10 text-status-active"
                    : "border-base-700 bg-base-800 text-ink-300 hover:border-base-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={`What happened on this ${type}?`}
            rows={4}
            className="w-full resize-none rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Log interaction"}
          </button>
        </form>
      </div>
    </div>
  );
}
