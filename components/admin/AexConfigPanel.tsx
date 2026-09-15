"use client";

import { useEffect, useState } from "react";
import { Sliders } from "lucide-react";

type AexConfig = {
  id: string;
  tierSilverMinPoints: number;
  tierGoldMinPoints: number;
  piWeightSpeedToLead: number;
  piWeightOutput: number;
  piWeightEngagementConversion: number;
  piWeightInteractionFulfilment: number;
  piWeightDataQuality: number;
  maxActiveLeadAssignments: number;
  maxActiveOpportunityAssignments: number;
  goldGateScoreThreshold: number;
  goldGateHours: number;
  dailyClubPointThreshold: number;
};

const FIELDS: { key: keyof AexConfig; label: string; step?: number; group: string }[] = [
  { key: "tierSilverMinPoints", label: "Silver tier — min points", group: "Tiers" },
  { key: "tierGoldMinPoints", label: "Gold tier — min points", group: "Tiers" },
  { key: "piWeightSpeedToLead", label: "Speed to Lead weight", step: 0.05, group: "Productivity Index weights (should sum to 1)" },
  { key: "piWeightOutput", label: "Output weight", step: 0.05, group: "Productivity Index weights (should sum to 1)" },
  { key: "piWeightEngagementConversion", label: "Engagement Conversion weight", step: 0.05, group: "Productivity Index weights (should sum to 1)" },
  { key: "piWeightInteractionFulfilment", label: "Interaction Fulfilment weight", step: 0.05, group: "Productivity Index weights (should sum to 1)" },
  { key: "piWeightDataQuality", label: "Data Quality weight", step: 0.05, group: "Productivity Index weights (should sum to 1)" },
  { key: "maxActiveLeadAssignments", label: "Max active leads per agent", group: "Allocation caps" },
  { key: "maxActiveOpportunityAssignments", label: "Max active opportunities per agent", group: "Allocation caps" },
  { key: "goldGateScoreThreshold", label: "Gold-gate score threshold", group: "Tier-gated lead access" },
  { key: "goldGateHours", label: "Gold-gate window (hours)", group: "Tier-gated lead access" },
  { key: "dailyClubPointThreshold", label: "Daily Club — points needed today", group: "Daily Club" },
];

const GROUPS = Array.from(new Set(FIELDS.map((f) => f.group)));

export function AexConfigPanel() {
  const [config, setConfig] = useState<AexConfig | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    fetch("/api/admin/aex-config")
      .then((res) => (res.ok ? res.json() : null))
      .then(setConfig);
  }, []);

  async function save() {
    if (!config) return;
    setStatus("saving");
    const res = await fetch("/api/admin/aex-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setStatus(res.ok ? "saved" : "idle");
  }

  if (!config) {
    return (
      <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
        <p className="text-xs text-ink-500">Loading AEX configuration…</p>
      </div>
    );
  }

  const piWeightSum =
    config.piWeightSpeedToLead +
    config.piWeightOutput +
    config.piWeightEngagementConversion +
    config.piWeightInteractionFulfilment +
    config.piWeightDataQuality;

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Sliders className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">AEX Configuration</h2>
      </div>
      <p className="mb-4 text-[11px] text-ink-500">
        Tier thresholds, Productivity Index weights, allocation caps, and
        tier-gating rules — PRD AV10. Values below are still placeholder
        defaults pending business sign-off; this panel just makes them
        editable without a code deploy.
      </p>

      {GROUPS.map((group) => (
        <div key={group} className="mb-4">
          <p className="mb-2 text-[11px] font-medium text-ink-500">
            {group}
            {group.startsWith("Productivity") && (
              <span className={`ml-2 ${Math.abs(piWeightSum - 1) > 0.01 ? "text-status-alert" : "text-status-active"}`}>
                (sum: {piWeightSum.toFixed(2)})
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key} className="text-[11px] text-ink-300">
                {f.label}
                <input
                  type="number"
                  step={f.step ?? 1}
                  value={config[f.key]}
                  onChange={(e) =>
                    setConfig({ ...config, [f.key]: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-base-950 hover:bg-white disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save configuration"}
        </button>
        {status === "saved" && <span className="text-[11px] text-status-active">Saved</span>}
      </div>
    </div>
  );
}
