// Pulled out of lib/targetTracker.ts (2026-10-23) — that file imports
// lib/prisma.ts for its DB-querying exports (getVisibleTargets,
// calculateActual), which since the multi-tenancy work now transitively
// pulls in Node's `async_hooks` (for the tenant-context
// AsyncLocalStorage). That's fine for server-only importers, but two
// "use client" components (WeeklyTargetGauge, CreateTargetModal) only
// ever needed this pure type+constant, not the DB logic — importing it
// from targetTracker.ts dragged the whole module, async_hooks included,
// into the client bundle, which webpack can't resolve (no browser
// equivalent) and failed the production build outright.
export type TargetMetric = "revenue" | "calls" | "meetings";

export const TARGET_METRICS: { key: TargetMetric; label: string }[] = [
  { key: "revenue", label: "Revenue (Closed Won)" },
  { key: "calls", label: "Calls Logged" },
  { key: "meetings", label: "Meetings Logged" },
];
