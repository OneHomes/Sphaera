"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector } from "recharts";

export const DONUT_COLORS = ["#009c91", "#2d6c85", "#e9a14b", "#8167b8", "#6ab4cc", "#d66b6e", "#8dad67", "#d9b95c", "#b4bed1"];

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function renderSector(
  props: { cx?: number; cy?: number; innerRadius?: number; outerRadius?: number; startAngle?: number; endAngle?: number; fill?: string; index: number; isActive: boolean },
  hovered: number | undefined
) {
  const lifted = props.isActive || props.index === hovered;
  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={(props.outerRadius ?? 0) + (lifted ? 6 : 0)}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      fill={props.fill}
      style={lifted ? { filter: "brightness(1.06)" } : undefined}
    />
  );
}

export type DonutRow = { name: string; value: number; count: number };

/**
 * Port of the source donutWidget(): largest 8 positive entries plus a non-clickable "Other",
 * a centre total, and a legend whose rows (and slices) drill into hrefFor(name).
 */
export function DonutWidget({
  rows,
  otherLabel,
  hrefFor,
  wide,
}: {
  rows: DonutRow[];
  otherLabel: string;
  hrefFor: (name: string) => string;
  wide?: boolean;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-ink-500">There is no spending in this selection. Change the filters above.</p>;
  }
  const positives = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const total = positives.reduce((s, r) => s + r.value, 0);
  if (total <= 0) {
    return (
      <p className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
        No positive net costs to display as a doughnut chart. The payment list remains available below.
      </p>
    );
  }
  const largest = positives.slice(0, 8).map((r) => ({ ...r, other: false }));
  const remaining = positives.slice(8);
  const shown = remaining.length
    ? [
        ...largest,
        {
          name: otherLabel,
          value: remaining.reduce((s, r) => s + r.value, 0),
          count: remaining.reduce((s, r) => s + r.count, 0),
          other: true,
        },
      ]
    : largest;

  return (
    <div>
      <div className={`flex flex-col gap-4 ${wide ? "md:flex-row md:items-center md:gap-8" : ""}`}>
        <div className={`relative mx-auto w-full max-w-[260px] ${wide ? "md:mx-0 md:shrink-0" : ""}`}>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={shown}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                shape={(p) => renderSector(p, hovered)}
                onMouseEnter={(_, i) => setHovered(i)}
                onMouseLeave={() => setHovered(undefined)}
                onClick={(_, i) => {
                  const item = shown[i];
                  if (item && !item.other) router.push(hrefFor(item.name));
                }}
                cursor="pointer"
              >
                {shown.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value, name) => [`${usd(Number(value ?? 0))} (${((Number(value ?? 0) / total) * 100).toFixed(1)}%)`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm font-semibold text-ink-50">{usd(total, true)}</p>
            <p className="text-[10px] text-ink-500">positive net costs</p>
          </div>
        </div>
        <div className={`space-y-1.5 ${wide ? "md:flex-1" : ""}`}>
          {shown.map((item, i) => {
            const row = (
              <>
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-50">{item.name}</span>
                  <span className="block text-[10px] text-ink-500">
                    {item.count.toLocaleString()} {item.count === 1 ? "payment" : "payments"}
                    {!item.other && " · Click to explore"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold text-ink-50">{usd(item.value, true)}</span>
                  <span className="block text-[10px] text-ink-500">{((item.value / total) * 100).toFixed(1)}%</span>
                </span>
              </>
            );
            const common = {
              onMouseEnter: () => setHovered(i),
              onMouseLeave: () => setHovered(undefined),
            };
            return item.other ? (
              <div key={item.name} {...common} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
                {row}
              </div>
            ) : (
              <Link
                key={item.name}
                href={hrefFor(item.name)}
                {...common}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-base-800 ${hovered === i ? "bg-base-800" : ""}`}
              >
                {row}
              </Link>
            );
          })}
        </div>
      </div>
      {remaining.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-500">
          The chart groups {remaining.length} smaller entries as Other. Every individual cost centre and payment remains
          accessible below.
        </p>
      )}
    </div>
  );
}
