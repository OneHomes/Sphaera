import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { data, coverage, segments, PRIMARY_SEGMENTS, cities } from "@/lib/marketIntelligence/insights";
import { histories, indexData } from "@/lib/marketIntelligence/indexEngine";
import { readDataset } from "@/lib/marketIntelligence/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [snap, idx] = await Promise.all([readDataset("snapshot", data), readDataset("index", indexData)]);
  const current = snap.data as typeof data;
  const history = idx.data as typeof indexData;
  const series = history.series.filter(
    (s) => cities.includes(s.city) && PRIMARY_SEGMENTS.includes(s.segment as (typeof PRIMARY_SEGMENTS)[number])
  );
  return Response.json({
    schemaVersion: "1.0",
    version: current.version,
    storage: { snapshot: snap.source, index: idx.source },
    coverageStatement: current.coverageStatement,
    segments,
    cities: coverage(),
    sourceChecks: current.sourceChecks,
    history: {
      version: history.version,
      series: series.length,
      points: series.reduce((n, s) => n + s.points.length, 0),
      sourceChecks: history.checks,
      cities: [...new Set(series.map((s) => s.city))].map((city) => ({
        city,
        series: series.filter((s) => s.city === city).length,
        points: series.filter((s) => s.city === city).reduce((n, s) => n + s.points.length, 0),
      })),
    },
  });
}
