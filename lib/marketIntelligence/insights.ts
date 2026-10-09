import snapshot from "@/data/market-intelligence/snapshot.json";

export type Observation = {
  id: string;
  city: string;
  area: string;
  segment: string;
  purpose: string;
  price: number;
  ppsf: number | null;
  period: string;
  retrievedAt: string;
  sourceUrl: string;
  source: string;
  basis: string;
  sampleCount: null;
};
export const data = snapshot;
export const cities = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar"];
export const PRIMARY_SEGMENTS = ["houses", "flats", "residential_plots", "commercial_plots"] as const;
export const observations = (snapshot.observations as Observation[]).filter(
  (r) => cities.includes(r.city) && PRIMARY_SEGMENTS.includes(r.segment as (typeof PRIMARY_SEGMENTS)[number])
);
export const segments: Record<string, string> = {
  houses: "Houses",
  flats: "Apartments",
  residential_plots: "Residential Plots",
  commercial_plots: "Commercial Plots",
};
export type Currency = keyof typeof snapshot.fx.rates;
export type Filters = { city?: string; segment?: string; purpose?: string; q?: string; sort?: string };

export function queryRows(f: Filters = {}) {
  return observations
    .filter(
      (r) =>
        (!f.city || f.city === "all" || r.city === f.city) &&
        (!f.segment || f.segment === "all" || r.segment === f.segment) &&
        (!f.purpose || r.purpose === f.purpose) &&
        (!f.q || r.area.toLowerCase().includes(f.q.toLowerCase()))
    )
    .sort((a, b) => {
      if (f.sort === "name-desc") return b.area.localeCompare(a.area);
      if (f.sort === "price-asc") return a.price - b.price;
      if (f.sort === "price-desc") return b.price - a.price;
      if (f.sort === "ppsf-asc" || f.sort === "ppsf-desc") {
        const av = a.ppsf ?? Number.POSITIVE_INFINITY;
        const bv = b.ppsf ?? Number.POSITIVE_INFINITY;
        return f.sort === "ppsf-asc" ? av - bv : bv - av;
      }
      if (f.sort === "period-asc") return a.period.localeCompare(b.period);
      if (f.sort === "period-desc") return b.period.localeCompare(a.period);
      return a.area.localeCompare(b.area);
    });
}
export function convert(pkr: number, currency: Currency) {
  return pkr / snapshot.fx.rates[currency];
}
export function money(pkr: number, currency: Currency = "PKR") {
  const n = convert(pkr, currency);
  if (currency === "PKR")
    return (
      "PKR " +
      (n >= 1e7
        ? `${+(n / 1e7).toFixed(2)} cr`
        : n >= 1e5
        ? `${+(n / 1e5).toFixed(2)} lakh`
        : n.toLocaleString("en-GB", { maximumFractionDigits: 0 }))
    );
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
export function dateLabel(s: string) {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function periodLabel(s: string) {
  return new Date(s + "-01T00:00:00Z").toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function coverage() {
  return cities.map((city) => ({
    city,
    segments: Object.keys(segments).map((segment) => ({
      segment,
      sale: observations.filter((r) => r.city === city && r.segment === segment && r.purpose === "buy").length,
      rent: observations.filter((r) => r.city === city && r.segment === segment && r.purpose === "rent").length,
    })),
  }));
}
export function parseFilters(p: URLSearchParams): Filters {
  const city = p.get("city") || "all";
  const segment = p.get("segment") || "all";
  const purpose = p.get("purpose") || "buy";
  const sort = p.get("sort") || "name";
  if (city !== "all" && !cities.includes(city)) throw Error("Unknown city");
  if (segment !== "all" && !segments[segment]) throw Error("Unknown segment");
  if (!["buy", "rent"].includes(purpose)) throw Error("Unknown purpose");
  if (
    !["name", "name-desc", "price-asc", "price-desc", "ppsf-asc", "ppsf-desc", "period-asc", "period-desc"].includes(
      sort
    )
  )
    throw Error("Unknown sort");
  return { city, segment, purpose, sort, q: (p.get("q") || "").slice(0, 120) };
}
