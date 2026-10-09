import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { data, observations } from "@/lib/marketIntelligence/insights";
import { readDataset } from "@/lib/marketIntelligence/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await readDataset("snapshot", data);
  const current = result.data as typeof data;
  return Response.json({
    version: current.version,
    fx: current.fx,
    pbs: current.context,
    series: observations,
    indexCatalogue: "/api/market-intelligence/v1/index",
    storage: result.source,
  });
}
