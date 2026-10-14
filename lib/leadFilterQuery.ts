import type { Prisma } from "@prisma/client";

// Shared between the /leads page (app/(app)/leads/page.tsx) and the
// /api/leads GET route's CSV export, so "what counts as a match" can
// never drift between what you see on screen and what you export.
// Filtering moved server-side (2026-10-15) because client-side filtering
// over the full Lead table stopped being viable once the HubSpot bulk
// import brought row count from ~2,000 to ~194,000 — see LeadInbox.tsx's
// git history for the full story.

export const LEADS_PAGE_SIZE = 50;

export type LeadFilterParams = {
  search: string;
  priority: string; // "All" or a LeadPriority value
  stage: string; // "All" or a LeadStage value
  source: string; // "All" or a value from leadSources
  market: string; // "All" or a real market string
  project: string; // "All" or a real project string
  scoreBand: "All" | "Hot" | "Warm" | "Cool";
  overdueOnly: boolean;
  tag: string;
};

export const defaultLeadFilterParams: LeadFilterParams = {
  search: "",
  priority: "All",
  stage: "All",
  source: "All",
  market: "All",
  project: "All",
  scoreBand: "All",
  overdueOnly: false,
  tag: "",
};

/** Reads filter + page values out of a Next.js page/route's searchParams. */
export function parseLeadFilterParams(
  searchParams: Record<string, string | string[] | undefined>
): LeadFilterParams & { page: number } {
  const get = (key: string): string => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const page = Math.max(1, Number(get("page")) || 1);
  return {
    search: get("search"),
    priority: get("priority") || "All",
    stage: get("stage") || "All",
    source: get("source") || "All",
    market: get("market") || "All",
    project: get("project") || "All",
    scoreBand: (get("scoreBand") || "All") as LeadFilterParams["scoreBand"],
    overdueOnly: get("overdueOnly") === "true",
    tag: get("tag"),
    page,
  };
}

/** Same reading logic, for a Route Handler's URLSearchParams instead. */
export function parseLeadFilterParamsFromUrl(url: URL): LeadFilterParams & { page: number } {
  const obj: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return parseLeadFilterParams(obj);
}

const SCORE_BAND_RANGES: Record<"Hot" | "Warm" | "Cool", Prisma.IntFilter> = {
  Hot: { gte: 75 },
  Warm: { gte: 50, lt: 75 },
  Cool: { lt: 50 },
};

/** Builds the Prisma `where` AND-list for everything except role scoping. */
export function buildLeadFilterWhere(params: LeadFilterParams): Prisma.LeadWhereInput[] {
  const clauses: Prisma.LeadWhereInput[] = [];

  if (params.search.trim()) clauses.push({ name: { contains: params.search.trim() } });
  if (params.priority !== "All") clauses.push({ priority: params.priority });
  if (params.stage !== "All") clauses.push({ stage: params.stage });
  if (params.source !== "All") clauses.push({ source: params.source });
  if (params.market !== "All") clauses.push({ market: params.market });
  if (params.project !== "All") clauses.push({ projectInterest: params.project });
  if (params.scoreBand !== "All") clauses.push({ score: SCORE_BAND_RANGES[params.scoreBand] });
  if (params.overdueOnly) clauses.push({ nextActionDueAt: { lt: new Date() } });
  if (params.tag.trim()) {
    const needle = params.tag.trim().replace(/^#/, "");
    clauses.push({ tags: { some: { tag: { contains: needle }, removedAt: null } } });
  }

  return clauses;
}
