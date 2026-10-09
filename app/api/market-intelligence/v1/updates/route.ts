import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { data } from "@/lib/marketIntelligence/insights";
import { readDataset } from "@/lib/marketIntelligence/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await readDataset("snapshot", data);
  const current = result.data as typeof data;
  return Response.json(
    { version: current.version, updates: current.updates, storage: result.source },
    { headers: { "Cache-Control": "no-store" } }
  );
}
