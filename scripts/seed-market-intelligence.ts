import { prisma } from "../lib/prisma";
import { readDataset, readObservations } from "../lib/marketIntelligence/db";
import { data } from "../lib/marketIntelligence/insights";
import { indexData } from "../lib/marketIntelligence/indexEngine";

// One-time manual trigger for the Market Intelligence seed (the API
// routes also trigger it lazily on first request — this script exists
// just to verify and report counts without needing a browser).
async function main() {
  const snapshot = await readDataset("snapshot", data);
  const index = await readDataset("index", indexData);
  const observations = await readObservations();
  const seriesCount = await prisma.indexSeries.count();

  console.log(`intelligence_datasets: snapshot=${snapshot.source} index=${index.source}`);
  console.log(`market_observations in Azure SQL: ${observations?.length ?? "unavailable"}`);
  console.log(`index_series in Azure SQL: ${seriesCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
