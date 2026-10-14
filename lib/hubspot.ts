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

// A long-running bulk import (~2000 pages for the real ~194,000-contact
// account) will eventually hit a transient network blip (ECONNRESET,
// a dropped TLS connection, etc.) — that's expected over a run lasting
// this long, not a real failure, so it's retried with backoff here
// rather than crashing the whole import over one bad request.
async function withRetry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Caps at 30s/attempt — a real DNS/network interruption during an
      // hours-long bulk import needs more runway than a quick backoff.
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** i)));
    }
  }
  throw lastErr;
}

async function hubspotFetch<T>(path: string): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`HubSpot request failed (${res.status}): ${data.message ?? res.statusText}`);
    }
    return data as T;
  });
}

async function hubspotPost<T>(path: string, body: unknown): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`HubSpot request failed (${res.status}): ${data.message ?? res.statusText}`);
    }
    return data as T;
  });
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

/**
 * Streams every contact (no artificial cap — HubSpot's cursor-based "after"
 * pagination has no 10,000-result limit the way the Search API does),
 * invoking `onPage` once per 100-contact page rather than accumulating
 * everything in memory, since the real account here has ~194,000 contacts.
 */
export async function streamAllHubSpotContacts(
  properties: string[],
  onPage: (contacts: HubSpotContact[]) => Promise<void | false>
): Promise<number> {
  let after: string | undefined;
  let total = 0;
  for (;;) {
    const page = await listHubSpotContacts(properties, 100, after);
    const keepGoing = await onPage(page.results);
    total += page.results.length;
    if (keepGoing === false) break;
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return total;
}

export type HubSpotObject = { id: string; properties: Record<string, string | null> };

/** Batch-fetches specific objects of any type by ID (HubSpot caps this at 100 IDs per call). */
export async function batchReadObjects(
  objectType: string,
  ids: string[],
  properties: string[]
): Promise<HubSpotObject[]> {
  const all: HubSpotObject[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const data = await hubspotPost<{ results: HubSpotObject[] }>(`/crm/v3/objects/${objectType}/batch/read`, {
      properties,
      inputs: chunk.map((id) => ({ id })),
    });
    all.push(...data.results);
  }
  return all;
}

/** Batch-fetches specific contacts by ID (HubSpot caps this at 100 IDs per call). */
export async function batchReadHubSpotContacts(ids: string[], properties: string[]): Promise<HubSpotContact[]> {
  return batchReadObjects("contacts", ids, properties);
}

/**
 * Batch-fetches which engagement-type objects (calls/emails/meetings/
 * notes/tasks) are associated with each given contact, via the v4
 * associations batch-read endpoint — one call covers up to 1000 contacts
 * at once, versus one association request per contact, which is the
 * only way pulling full activity history for ~2000 leads is feasible
 * within HubSpot's rate limits.
 */
export async function batchReadAssociations(
  fromObjectType: string,
  toObjectType: string,
  fromIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (let i = 0; i < fromIds.length; i += 1000) {
    const chunk = fromIds.slice(i, i + 1000);
    const data = await hubspotPost<{
      results: { from: { id: string }; to: { toObjectId: number }[] }[];
    }>(`/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`, {
      inputs: chunk.map((id) => ({ id })),
    });
    for (const r of data.results) {
      result.set(
        r.from.id,
        r.to.map((t) => String(t.toObjectId))
      );
    }
  }
  return result;
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
