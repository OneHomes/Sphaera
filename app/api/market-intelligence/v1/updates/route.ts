import { data } from "@/lib/marketIntelligence/insights";
import { readDataset } from "@/lib/marketIntelligence/db";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async () => {
      const result = await readDataset("snapshot", data);
      const current = result.data as typeof data;
      return Response.json(
        { version: current.version, updates: current.updates, storage: result.source },
        { headers: { "Cache-Control": "no-store" } }
      );
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
