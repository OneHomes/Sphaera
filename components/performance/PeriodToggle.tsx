"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { PerformancePeriod } from "@/lib/agentPerformanceMetrics";

const OPTIONS: { value: PerformancePeriod; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function PeriodToggle({ current }: { current: PerformancePeriod }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPeriod(period: PerformancePeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`/performance?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-base-700 bg-base-900 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setPeriod(opt.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            current === opt.value
              ? "bg-base-800 text-ink-50"
              : "text-ink-500 hover:text-ink-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
