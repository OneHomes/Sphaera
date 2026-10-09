import config from "@/data/market-intelligence/forecast.json";
import collection from "@/data/market-intelligence/index-series.json";
import { PRIMARY_SEGMENTS } from "@/lib/marketIntelligence/insights";

export const forecastConfig = config;
export type ForecastRates = { downside: number; reference: number; upside: number };
export const forecastCities = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar"];
type Point = { period: string; price: number; ppsf: number | null };
type Series = { city: string; segment: string; points: Point[] };
const histories = (collection.series as Series[]).filter(
  (s) => forecastCities.includes(s.city) && PRIMARY_SEGMENTS.includes(s.segment as (typeof PRIMARY_SEGMENTS)[number])
);
const monthNumber = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return y * 12 + m - 1;
};
const median = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y);
  if (!a.length) return 0;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};
const percentile = (values: number[], p: number) => {
  const a = [...values].sort((x, y) => x - y);
  if (!a.length) return 0;
  const i = (a.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};
const clamp = (n: number) => Math.max(-30, Math.min(30, n));
function annualChange(s: Series) {
  const latest = s.points.at(-1);
  if (!latest) return null;
  const previous = s.points.find((p) => monthNumber(p.period) === monthNumber(latest.period) - 12);
  return previous ? 100 * (latest.price / previous.price - 1) : null;
}
function fullPeriodChange(s: Series) {
  const first = s.points[0];
  const last = s.points.at(-1);
  if (!first || !last) return null;
  const months = monthNumber(last.period) - monthNumber(first.period);
  return months > 0 ? 100 * (Math.pow(last.price / first.price, 12 / months) - 1) : null;
}
export function cityEvidence(city: string) {
  const series = histories.filter((s) => s.city === city && s.points.length > 1);
  const annual = series.map(annualChange).filter((n): n is number => n !== null && Number.isFinite(n));
  const fallback = series.map(fullPeriodChange).filter((n): n is number => n !== null && Number.isFinite(n));
  const changes = annual.length ? annual : fallback;
  const latestPpsf = series
    .map((s) => s.points.at(-1)?.ppsf)
    .filter((n): n is number => n !== undefined && n !== null && Number.isFinite(n) && n > 0);
  return {
    city,
    seriesCount: series.length,
    annualCount: annual.length,
    observedAnnualChange: median(changes),
    rates: {
      downside: clamp(percentile(changes, 0.25)),
      reference: clamp(median(changes)),
      upside: clamp(percentile(changes, 0.75)),
    },
    baselinePpsf: latestPpsf.length ? median(latestPpsf) : null,
  };
}
export function projectCityMarket(city: string) {
  const evidence = cityEvidence(city);
  const rows = projectMarket(evidence.rates).map((row) => ({
    ...row,
    downsidePpsf: evidence.baselinePpsf === null ? null : (evidence.baselinePpsf * row.downside) / 100,
    referencePpsf: evidence.baselinePpsf === null ? null : (evidence.baselinePpsf * row.reference) / 100,
    upsidePpsf: evidence.baselinePpsf === null ? null : (evidence.baselinePpsf * row.upside) / 100,
  }));
  return { evidence, rows };
}
export function projectMarket(rates: ForecastRates) {
  for (const key of ["downside", "reference", "upside"] as const)
    if (!Number.isFinite(rates[key]) || rates[key] < -30 || rates[key] > 30)
      throw Error("Annual growth must be between -30% and 30%.");
  if (rates.downside > rates.reference || rates.reference > rates.upside)
    throw Error("Keep downside at or below illustrative growth, and upside at or above it.");
  return Array.from({ length: config.horizonYears + 1 }, (_, n) => ({
    year: config.baseYear + n,
    downside: config.baseline * Math.pow(1 + rates.downside / 100, n),
    reference: config.baseline * Math.pow(1 + rates.reference / 100, n),
    upside: config.baseline * Math.pow(1 + rates.upside / 100, n),
  }));
}
