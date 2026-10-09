import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { indexData, type IndexSeries } from "@/lib/marketIntelligence/indexEngine";
import { PRIMARY_SEGMENTS, cities } from "@/lib/marketIntelligence/insights";
import { readDataset } from "@/lib/marketIntelligence/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const p = new URL(request.url).searchParams;
  const result = await readDataset("index", indexData);
  const current = result.data as typeof indexData;
  const sourceSeries = (current.series as IndexSeries[]).filter(
    (s) => cities.includes(s.city) && PRIMARY_SEGMENTS.includes(s.segment as (typeof PRIMARY_SEGMENTS)[number])
  );
  const rows = sourceSeries.filter((s) =>
    ["city", "segment", "area", "size", "purpose"].every((key) => !p.get(key) || (s as never as Record<string, string>)[key] === p.get(key))
  );
  const id = p.get("id");
  if (id) {
    const series = sourceSeries.find((s) => s.id === id);
    return series
      ? Response.json({ version: current.version, series, storage: result.source })
      : Response.json({ error: "Unknown series" }, { status: 404 });
  }
  return Response.json({
    version: current.version,
    total: rows.length,
    storage: result.source,
    series: rows.map(({ points, ...s }) => ({ ...s, pointCount: points.length, from: points[0]?.period, to: points.at(-1)?.period })),
  });
}
