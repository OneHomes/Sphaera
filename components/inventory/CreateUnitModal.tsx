"use client";

import { useState } from "react";
import { X } from "lucide-react";

type ProjectSummary = { id: string; name: string; unitCount: number };

export function CreateUnitModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: ProjectSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [unitType, setUnitType] = useState("");
  const [size, setSize] = useState("");
  const [areaBasis, setAreaBasis] = useState("sqft");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          unitNumber,
          floor: floor || null,
          unitType,
          size: Number(size),
          areaBasis,
          price: Number(price),
          currency,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create unit");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">New Unit</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Unit number"
              className={inputClass}
            />
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="Floor (optional)"
              className={inputClass}
            />
          </div>
          <input
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            placeholder="Unit type (e.g. 2BR Apartment)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Size"
              type="number"
              className={inputClass}
            />
            <select value={areaBasis} onChange={(e) => setAreaBasis(e.target.value)} className={inputClass}>
              <option value="sqft">sqft</option>
              <option value="sqm">sqm</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              type="number"
              className={inputClass}
            />
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="Currency"
              className={inputClass}
            />
          </div>
          <p className="text-[10px] text-ink-600">
            New units start as &quot;blocked&quot; — upload a floor plan from the inventory table to make one
            available.
          </p>
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !projectId || !unitNumber.trim() || !unitType.trim() || !size || !price}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Create unit"}
          </button>
        </form>
      </div>
    </div>
  );
}
