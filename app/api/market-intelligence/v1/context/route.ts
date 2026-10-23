import { data, observations } from "@/lib/marketIntelligence/insights";
import { readDataset } from "@/lib/marketIntelligence/db";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async () => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
