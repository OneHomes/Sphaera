"use client";

import { useRef, useState } from "react";
import { Plus, Building2, Upload, CheckCircle2 } from "lucide-react";
import type { UiUnit, UnitStatus } from "@/lib/inventoryData";
import { UNIT_STATUSES } from "@/lib/inventoryData";
import { CreateProjectModal } from "./CreateProjectModal";
import { CreateUnitModal } from "./CreateUnitModal";

type ProjectSummary = { id: string; name: string; unitCount: number };

const statusStyles: Record<UnitStatus, string> = {
  available: "bg-status-active/15 text-status-active",
  reserved: "bg-status-alert/15 text-status-alert",
  sold: "bg-tier-gold/15 text-tier-gold",
  blocked: "bg-base-700 text-ink-500",
};

function formatPrice(price: number, currency: string): string {
  return `${currency} ${price.toLocaleString()}`;
}

function UploadButton({
  label,
  done,
  onUpload,
}: {
  label: string;
  done: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
          done
            ? "border-status-active/40 text-status-active"
            : "border-base-700 text-ink-500 hover:text-ink-300"
        }`}
      >
        {done ? <CheckCircle2 className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function InventoryPage({
  initialProjects,
  initialUnits,
  isAdmin,
}: {
  initialProjects: ProjectSummary[];
  initialUnits: UiUnit[];
  isAdmin: boolean;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [units, setUnits] = useState(initialUnits);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    Promise.all([
      fetch("/api/inventory/projects").then((r) => r.json()),
      fetch("/api/inventory/units").then((r) => r.json()),
    ]).then(([p, u]) => {
      setProjects(p);
      setUnits(u);
    });
  }

  const filteredUnits =
    selectedProjectId === "all" ? units : units.filter((u) => u.projectId === selectedProjectId);

  async function handleStatusChange(unitId: string, status: UnitStatus) {
    setError(null);
    const res = await fetch(`/api/inventory/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to update status");
      return;
    }
    reload();
  }

  async function handleDocUpload(unitId: string, kind: "floorPlan" | "views", file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    const res = await fetch(`/api/inventory/units/${unitId}/documents`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to upload");
      return;
    }
    reload();
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Inventory</h1>
          <p className="mt-1 text-sm text-ink-500">
            {units.length} unit(s) across {projects.length} project(s)
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateProject(true)}
              className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
            >
              <Building2 className="h-3.5 w-3.5" />
              New Project
            </button>
            <button
              onClick={() => setShowCreateUnit(true)}
              disabled={projects.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New Unit
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-2 text-xs text-status-inactive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedProjectId("all")}
          className={`rounded-full px-3 py-1 text-xs ${
            selectedProjectId === "all"
              ? "bg-ink-50 text-base-950"
              : "border border-base-700 text-ink-500 hover:text-ink-300"
          }`}
        >
          All
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProjectId(p.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              selectedProjectId === p.id
                ? "bg-ink-50 text-base-950"
                : "border border-base-700 text-ink-500 hover:text-ink-300"
            }`}
          >
            {p.name} ({p.unitCount})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-700">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-base-700 bg-base-900 text-ink-500">
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Payment Plan</th>
              <th className="px-3 py-2">Status</th>
              {isAdmin && <th className="px-3 py-2">Documents</th>}
            </tr>
          </thead>
          <tbody>
            {filteredUnits.map((u) => (
              <tr key={u.id} className="border-b border-base-800 text-ink-300 last:border-0">
                <td className="px-3 py-2">{u.projectName}</td>
                <td className="px-3 py-2 text-ink-50">
                  {u.unitNumber}
                  {u.floor && <span className="text-ink-500"> · Floor {u.floor}</span>}
                </td>
                <td className="px-3 py-2">{u.unitType}</td>
                <td className="px-3 py-2">
                  {u.size} {u.areaBasis}
                </td>
                <td className="px-3 py-2">{formatPrice(u.price, u.currency)}</td>
                <td className="px-3 py-2">{u.paymentPlanName ?? "—"}</td>
                <td className="px-3 py-2">
                  {isAdmin ? (
                    <select
                      value={u.status}
                      onChange={(e) => handleStatusChange(u.id, e.target.value as UnitStatus)}
                      className={`rounded-full border-0 px-2 py-0.5 text-[11px] outline-none ${statusStyles[u.status]}`}
                    >
                      {UNIT_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-base-900 text-ink-50">
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusStyles[u.status]}`}>
                      {u.status}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <UploadButton
                        label="Floor plan"
                        done={u.hasFloorPlan}
                        onUpload={(file) => handleDocUpload(u.id, "floorPlan", file)}
                      />
                      <UploadButton
                        label="Views"
                        done={u.hasViews}
                        onUpload={(file) => handleDocUpload(u.id, "views", file)}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredUnits.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-3 py-6 text-center text-ink-500">
                  No units yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={() => {
            setShowCreateProject(false);
            reload();
          }}
        />
      )}

      {showCreateUnit && (
        <CreateUnitModal
          projects={projects}
          onClose={() => setShowCreateUnit(false)}
          onCreated={() => {
            setShowCreateUnit(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
