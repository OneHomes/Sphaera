import collection from "@/data/market-intelligence/index-series.json";
import { PRIMARY_SEGMENTS, cities } from "@/lib/marketIntelligence/insights";

export type IndexPoint = { period: string; price: number; ppsf: number | null; sourceIndex: number | null };
export type IndexSeries = {
  id: string;
  city: string;
  area: string;
  segment: string;
  purpose: string;
  size: string;
  url: string;
  retrievedAt: string;
  points: IndexPoint[];
  cadence?: string;
  periodBasis?: string;
};
export type Metric = "price" | "ppsf" | "rebased" | "sourceIndex";
export const indexData = collection;
export const histories = (collection.series as IndexSeries[]).filter(
  (s) => cities.includes(s.city) && PRIMARY_SEGMENTS.includes(s.segment as (typeof PRIMARY_SEGMENTS)[number])
);
export const label = (s: IndexSeries) =>
  `${s.city} · ${s.area} · ${s.size} · ${s.segment.replaceAll("_", " ")} · ${s.purpose === "buy" ? "Sale" : "Rent"}`;
export function monthNumber(p: string) {
  const [y, m] = p.split("-").map(Number);
  return y * 12 + m - 1;
}
export function monthString(n: number) {
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
}
export function change(s: IndexSeries, months: number) {
  const latest = s.points.at(-1);
  if (!latest) return null;
  const previous = s.points.find((p) => monthNumber(p.period) === monthNumber(latest.period) - months);
  return previous ? 100 * (latest.price / previous.price - 1) : null;
}
export function chartData(series: IndexSeries[], metric: Metric, range: number, rate = 1) {
  if (!series.length) return { rows: [], basePeriod: null as string | null };
  const end = Math.max(...series.flatMap((s) => s.points.map((p) => monthNumber(p.period))));
  const first = Math.min(...series.flatMap((s) => s.points.map((p) => monthNumber(p.period))));
  const start = range ? Math.max(first, end - range + 1) : first;
  const periods = Array.from({ length: end - start + 1 }, (_, i) => monthString(start + i));
  const basePeriod =
    metric === "rebased" ? periods.find((p) => series.every((s) => s.points.some((x) => x.period === p))) || null : null;
  const rows = periods.map((period) => {
    const row: Record<string, string | number | null> = { period };
    for (const s of series) {
      const p = s.points.find((p) => p.period === period);
      const base = s.points.find((p) => p.period === basePeriod)?.price;
      row[s.id] = !p
        ? null
        : metric === "rebased"
        ? base && basePeriod && period >= basePeriod
          ? (p.price / base) * 100
          : null
        : metric === "sourceIndex"
        ? p.sourceIndex
        : metric === "ppsf"
        ? p.ppsf === null
          ? null
          : p.ppsf / rate
        : p.price / rate;
    }
    return row;
  });
  return { rows, basePeriod };
}
export function filterHistories(f: { city?: string; area?: string; segment?: string; purpose?: string; size?: string }) {
  return histories.filter(
    (s) =>
      (!f.city || s.city === f.city) &&
      (!f.area || s.area === f.area) &&
      (!f.segment || s.segment === f.segment) &&
      (!f.purpose || s.purpose === f.purpose) &&
      (!f.size || s.size === f.size)
  );
}
