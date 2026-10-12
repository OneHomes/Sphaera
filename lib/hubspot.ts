// HubSpot integration — Private App access token (static bearer token,
// no OAuth dance needed since this is a single-account server-to-server
// integration). Mirrors the shape of lib/salesforce.ts: a describe-style
// metadata fetch plus a records fetch.

const HUBSPOT_API_BASE = "https://api.hubapi.com";

function getAccessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
  return token;
}

async function hubspotFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HubSpot request failed (${res.status}): ${data.message ?? res.statusText}`);
  }
  return data as T;
}

export type HubSpotPropertyMeta = {
  name: string;
  label: string;
  type: string;
  groupName: string;
  hidden: boolean;
  options: { label: string; value: string }[];
};

/** Lists all property definitions (standard + custom) for a HubSpot object type, e.g. "contacts". */
export async function listHubSpotProperties(objectType: string): Promise<HubSpotPropertyMeta[]> {
  const data = await hubspotFetch<{ results: HubSpotPropertyMeta[] }>(`/crm/v3/properties/${objectType}`);
  return data.results;
}

export type HubSpotContact = { id: string; properties: Record<string, string | null> };

/** Fetches a page of contacts with the given properties explicitly requested. */
export async function listHubSpotContacts(
  properties: string[],
  limit = 10,
  after?: string
): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
  const params = new URLSearchParams({ limit: String(limit), properties: properties.join(",") });
  if (after) params.set("after", after);
  return hubspotFetch(`/crm/v3/objects/contacts?${params.toString()}`);
}

/** Fetches every contact matching the given properties, paginating automatically up to `limit` total records. */
export async function fetchAllHubSpotContacts(properties: string[], limit: number): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = [];
  let after: string | undefined;
  while (all.length < limit) {
    const page = await listHubSpotContacts(properties, Math.min(100, limit - all.length), after);
    all.push(...page.results);
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

export type HubSpotOwner = { id: string; email: string };

/** Lists every HubSpot owner (user) so numeric hubspot_owner_id values can be resolved to an email. */
export async function listHubSpotOwners(): Promise<HubSpotOwner[]> {
  const owners: HubSpotOwner[] = [];
  let after: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const page = await hubspotFetch<{ results: HubSpotOwner[]; paging?: { next?: { after: string } } }>(
      `/crm/v3/owners?${params.toString()}`
    );
    owners.push(...page.results);
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return owners;
}
