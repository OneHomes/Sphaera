// The real Azure bill, per resource, from the Cost Management Query API.
// Signs in as Sphaera's own app registration (the one used for Microsoft
// sign-in: AZURE_AD_CLIENT_ID / SECRET / TENANT_ID), which needs the
// "Cost Management Reader" role on the subscription. AZURE_COST_SUBSCRIPTION_ID
// says which subscription. Azure refreshes cost data a few times a day, so
// results are cached for 30 minutes (the API is also heavily rate-limited).

export type BillLine = { resourceGroup: string; resource: string; resourceType: string; service: string; cost: number };
export type AzureBill =
  | { state: "ok"; currency: string; total: number; lines: BillLine[]; fetchedAt: string }
  | { state: "not_configured"; missing: string[] }
  | { state: "error"; message: string };

const cache = new Map<string, { at: number; bill: AzureBill }>();
const TTL_MS = 30 * 60 * 1000;

async function token(): Promise<string> {
  const tenant = process.env.AZURE_AD_TENANT_ID!;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      scope: "https://management.azure.com/.default",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Couldn't sign in to Azure (${res.status})`);
  return (await res.json()).access_token;
}

// `from`/`to` are YYYY-MM-DD (inclusive).
export async function azureBill(from: string, to: string): Promise<AzureBill> {
  const missing = ["AZURE_COST_SUBSCRIPTION_ID", "AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) return { state: "not_configured", missing };

  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bill;

  let bill: AzureBill;
  try {
    const sub = process.env.AZURE_COST_SUBSCRIPTION_ID;
    const res = await fetch(
      `https://management.azure.com/subscriptions/${sub}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ActualCost",
          timeframe: "Custom",
          timePeriod: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
          dataset: {
            granularity: "None",
            aggregation: { totalCost: { name: "Cost", function: "Sum" } },
            grouping: [
              { type: "Dimension", name: "ResourceGroupName" },
              { type: "Dimension", name: "ResourceId" },
              { type: "Dimension", name: "ResourceType" },
              { type: "Dimension", name: "ServiceName" },
            ],
          },
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error("Azure refused: the app registration needs the Cost Management Reader role on the subscription");
    }
    if (res.status === 429) throw new Error("Azure is rate-limiting cost queries; try again in a minute");
    if (!res.ok) throw new Error(`Cost query failed (${res.status})`);

    const props = (await res.json()).properties as { columns: { name: string }[]; rows: unknown[][] };
    const col = (name: string) => props.columns.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    const [iCost, iRg, iRes, iType, iSvc, iCur] = ["Cost", "ResourceGroupName", "ResourceId", "ResourceType", "ServiceName", "Currency"].map(col);
    const lines: BillLine[] = props.rows
      .map((r) => ({
        resourceGroup: String(r[iRg] ?? ""),
        resource: String(r[iRes] ?? "").split("/").pop() || "(other)",
        resourceType: String(r[iType] ?? "").split("/").pop() ?? "",
        service: String(r[iSvc] ?? ""),
        cost: Number(r[iCost] ?? 0),
      }))
      .filter((l) => l.cost > 0.0001)
      .sort((a, b) => b.cost - a.cost);
    bill = {
      state: "ok",
      currency: String(props.rows[0]?.[iCur] ?? "USD"),
      total: lines.reduce((s, l) => s + l.cost, 0),
      lines,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), bill });
  } catch (err) {
    bill = { state: "error", message: err instanceof Error ? err.message : "Cost query failed" };
  }
  return bill;
}
