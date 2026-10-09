import { prisma } from "@/lib/prisma";
import snapshot from "@/data/market-intelligence/snapshot.json";
import indexCollection from "@/data/market-intelligence/index-series.json";
import forecast from "@/data/market-intelligence/forecast.json";

// Prisma/Azure SQL equivalent of the handed-over module's Cloudflare D1
// layer (lib/db.ts there). Same shape — a one-time seed from the
// reviewed JSON snapshot into three SQL tables, then API routes read
// from SQL with the bundled JSON as a fallback if the database is ever
// unreachable. Seeded once per process; a fresh deploy re-checks and
// re-seeds an empty database automatically.
let seedCheck: Promise<void> | null = null;

async function seedIntelligenceDatabase(): Promise<void> {
  const existing = await prisma.intelligenceDataset.findUnique({ where: { key: "snapshot" } });
  if (existing) return;

  const now = new Date();
  await prisma.intelligenceDataset.createMany({
    data: [
      { key: "snapshot", version: String(snapshot.version), payload: JSON.stringify(snapshot), updatedAt: now },
      { key: "index", version: String(indexCollection.version), payload: JSON.stringify(indexCollection), updatedAt: now },
      { key: "forecast", version: String(forecast.version), payload: JSON.stringify(forecast), updatedAt: now },
    ],
  });

  const observationRows = snapshot.observations.map((record) => ({
    id: record.id,
    city: record.city,
    area: record.area,
    segment: record.segment,
    purpose: record.purpose,
    period: record.period,
    price: BigInt(record.price),
    ppsf: record.ppsf ?? null,
    retrievedAt: record.retrievedAt,
    sourceUrl: record.sourceUrl,
    source: record.source,
    basis: record.basis,
  }));
  for (let i = 0; i < observationRows.length; i += 500) {
    await prisma.marketObservation.createMany({ data: observationRows.slice(i, i + 500) });
  }

  const seriesRows = indexCollection.series.map((series) => ({
    id: series.id,
    city: series.city,
    area: series.area,
    segment: series.segment,
    purpose: series.purpose,
    size: series.size,
    payload: JSON.stringify(series),
  }));
  for (let i = 0; i < seriesRows.length; i += 500) {
    await prisma.indexSeries.createMany({ data: seriesRows.slice(i, i + 500) });
  }
}

function ensureSeeded(): Promise<void> {
  if (!seedCheck) {
    seedCheck = seedIntelligenceDatabase().catch((err) => {
      seedCheck = null; // allow a retry on the next call if seeding failed
      throw err;
    });
  }
  return seedCheck;
}

export async function readDataset<T>(
  key: "snapshot" | "index" | "forecast",
  fallback: T
): Promise<{ data: T; source: "sql" | "snapshot"; version: string }> {
  try {
    await ensureSeeded();
    const row = await prisma.intelligenceDataset.findUnique({ where: { key } });
    if (!row) return { data: fallback, source: "snapshot", version: "fallback" };
    return { data: JSON.parse(row.payload) as T, source: "sql", version: row.version };
  } catch {
    return { data: fallback, source: "snapshot", version: "fallback" };
  }
}

export async function readObservations() {
  try {
    await ensureSeeded();
    const rows = await prisma.marketObservation.findMany({ orderBy: { area: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      city: r.city,
      area: r.area,
      segment: r.segment,
      purpose: r.purpose,
      price: Number(r.price), // bigint -> number; well within safe-integer range for PKR prices
      ppsf: r.ppsf,
      period: r.period,
      retrievedAt: r.retrievedAt,
      sourceUrl: r.sourceUrl,
      source: r.source,
      basis: r.basis,
      sampleCount: null as null,
    }));
  } catch {
    return null;
  }
}
