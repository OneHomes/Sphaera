import { prisma } from "./prisma";
import { digitsOf } from "./leadPhoneMatch";
import { sakariMessagePhone, sakariTimelineRow, type SakariMessage } from "./sakariWebhook";

// One-off catch-up of past Sakari SMS onto lead timelines (the webhook only
// covers messages from when it was registered). The account holds ~1.75M
// messages, so instead of paging all of them this goes lead by lead:
// contacts filtered by the lead's phone digits, then only those contacts'
// messages. Safe to re-run: rows already on a timeline ("sakari:<id>") are
// skipped. Needs SAKARI_ACCOUNT_ID, SAKARI_CLIENT_ID, SAKARI_CLIENT_SECRET.

const API = "https://api.sakari.io";

async function token(): Promise<string> {
  const { SAKARI_CLIENT_ID, SAKARI_CLIENT_SECRET } = process.env;
  if (!SAKARI_CLIENT_ID || !SAKARI_CLIENT_SECRET) throw new Error("SAKARI_CLIENT_ID / SAKARI_CLIENT_SECRET not set");
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: SAKARI_CLIENT_ID, client_secret: SAKARI_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Sakari token request -> ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

type Page<T> = { data: T[]; pagination?: { hasNext?: boolean } };
type SakariContact = { id: string; mobile?: { number?: string } };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a couple of retries — Sakari's API occasionally resets connections mid-run. */
async function get<T>(bearer: string, path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${bearer}` } });
      if (!res.ok) throw new Error(`Sakari GET ${path.split("?")[0]} -> ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt >= 3) throw err;
      await pause(1000 * attempt);
    }
  }
}

export type SakariHistoryResult = {
  leadsChecked: number;
  leadsWithSakari: number;
  messagesFound: number;
  imported: number;
  leadsFailed: number;
};

export async function syncSakariHistory(
  opts: { dryRun?: boolean; onProgress?: (r: SakariHistoryResult) => void } = {}
): Promise<SakariHistoryResult> {
  const accountId = process.env.SAKARI_ACCOUNT_ID;
  if (!accountId) throw new Error("SAKARI_ACCOUNT_ID not set");
  const bearer = await token();
  const base = `/v1/accounts/${accountId}`;

  const existing = new Set(
    (
      await prisma.leadTimelineEvent.findMany({
        where: { hubspotEngagementId: { startsWith: "sakari:" } },
        select: { leadId: true, hubspotEngagementId: true },
      })
    ).map((r) => `${r.leadId}|${r.hubspotEngagementId}`)
  );
  const leads = await prisma.lead.findMany({ select: { id: true, name: true, contact: true } });
  const result: SakariHistoryResult = { leadsChecked: 0, leadsWithSakari: 0, messagesFound: 0, imported: 0, leadsFailed: 0 };

  for (const lead of leads) {
    result.leadsChecked++;
    const tail = digitsOf(lead.contact).slice(-10);
    if (tail.length < 7) continue;
    try {
      // "mobile" is a contains-filter; the exact tail check drops numbers
      // that merely contain these digits somewhere in the middle.
      const contacts = (await get<Page<SakariContact>>(bearer, `${base}/contacts?mobile=${tail}&limit=100`)).data.filter((c) =>
        digitsOf(c.mobile?.number ?? "").endsWith(tail)
      );
      if (contacts.length > 0) result.leadsWithSakari++;

      for (const contact of contacts) {
        for (let offset = 0; ; offset += 100) {
          const page = await get<Page<SakariMessage>>(bearer, `${base}/messages?contactId=${contact.id}&offset=${offset}&limit=100`);
          // Guard: if the contactId filter were ever ignored this would walk
          // the whole ~1.75M-message account — stop instead.
          if ((page.data ?? []).some((m) => (m.contact as { id?: string } | undefined)?.id !== contact.id)) {
            throw new Error("Sakari returned messages for other contacts — contactId filter not applied");
          }
          const rows = [];
          for (const message of page.data ?? []) {
            result.messagesFound++;
            const phone = sakariMessagePhone(message) ?? contact.mobile?.number ?? lead.contact;
            const row = sakariTimelineRow(message, phone, lead.name);
            const key = `${lead.id}|${row.externalId}`;
            if (row.externalId && existing.has(key)) continue;
            existing.add(key);
            rows.push({ leadId: lead.id, type: row.type, summary: row.summary, occurredAt: row.occurredAt, hubspotEngagementId: row.externalId });
          }
          if (rows.length > 0 && !opts.dryRun) await prisma.leadTimelineEvent.createMany({ data: rows });
          result.imported += rows.length;
          if (!page.pagination?.hasNext || (page.data ?? []).length === 0) break;
          await pause(200);
        }
      }
    } catch (err) {
      result.leadsFailed++;
      console.error(`Sakari history: lead ${lead.id} failed:`, err);
    }
    opts.onProgress?.(result);
    await pause(200);
  }
  return result;
}
