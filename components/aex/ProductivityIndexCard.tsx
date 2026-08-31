"use client";

import { useEffect, useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { Gauge } from "lucide-react";
import type { ProductivityIndexResult } from "@/lib/productivityIndex";

const dimensionLabels: Record<
  keyof ProductivityIndexResult["dimensions"],
  string
> = {
  speedToLead: "Speed to Lead",
  output: "Output",
  engagementConversion: "Engagement Conversion",
  interactionFulfilment: "Interaction Fulfilment",
  dataQuality: "Data Quality",
};

function scoreColor(score: number): string {
  if (score >= 70) return "bg-status-active";
  if (score >= 40) return "bg-status-alert";
  return "bg-status-inactive";
}

export function ProductivityIndexCard() {
  const [data, setData] = useState<ProductivityIndexResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/productivity-index")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <WidgetCard title="Productivity Index" icon={Gauge}>
      {isLoading ? (
        <p className="text-xs text-ink-500">Calculating…</p>
      ) : data ? (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-ink-50">
              {data.overall}
            </span>
            <span className="text-xs text-ink-500">/ 100</span>
          </div>
          <div className="space-y-2">
            {(Object.keys(data.dimensions) as Array<
              keyof ProductivityIndexResult["dimensions"]
            >).map((key) => {
              const dim = data.dimensions[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-300">{dimensionLabels[key]}</span>
                    <span className="text-ink-500">{dim.score}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-base-700">
                    <div
                      className={`h-1.5 rounded-full ${scoreColor(dim.score)}`}
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-ink-500">
                    {dim.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-ink-500">
            Weights are provisional pending business sign-off (PRD 14.3).
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-500">Couldn&apos;t load index.</p>
      )}
    </WidgetCard>
  );
}