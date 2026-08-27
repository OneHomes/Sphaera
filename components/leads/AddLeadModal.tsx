"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function AddLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("");
  const [market, setMarket] = useState("UK");
  const [projectInterest, setProjectInterest] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !contact.trim() || !source.trim()) {
      setError("Name, contact, and source are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, source, market, projectInterest }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create lead");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Add lead</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone or email"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (e.g. Meta Ads, HubSpot)"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300 outline-none"
          >
            <option value="UK">UK</option>
            <option value="UAE">UAE</option>
          </select>
          <input
            value={projectInterest}
            onChange={(e) => setProjectInterest(e.target.value)}
            placeholder="Project / unit interest"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add lead"}
          </button>
        </form>
      </div>
    </div>
  );
}