import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { data, queryRows, parseFilters, type Observation } from "@/lib/marketIntelligence/insights";
import { readObservations, readDataset } from "@/lib/marketIntelligence/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = new URL(request.url).searchParams;
    const f = parseFilters(p);
    const limit = Number(p.get("limit") || 100);
    const offset = Number(p.get("offset") || 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(offset) || offset < 0)
      throw Error("limit must be 1 to 500 and offset a non-negative integer");

    const sqlRows = await readObservations();
    const rows = sqlRows
      ? sqlRows
          .filter(
            (r) =>
              (!f.city || f.city === "all" || r.city === f.city) &&
              (!f.segment || f.segment === "all" || r.segment === f.segment) &&
              (!f.purpose || r.purpose === f.purpose) &&
              (!f.q || r.area.toLowerCase().includes(f.q.toLowerCase()))
          )
          .sort((a, b) =>
            f.sort === "price-asc" ? a.price - b.price : f.sort === "price-desc" ? b.price - a.price : a.area.localeCompare(b.area)
          )
      : queryRows(f);
    const dataset = await readDataset("snapshot", data);

    return Response.json(
      {
        schemaVersion: "1.0",
        version: dataset.version,
        total: rows.length,
        limit,
        offset,
        storage: sqlRows ? "sql" : "snapshot",
        observations: (rows as Observation[]).slice(offset, offset + limit),
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
