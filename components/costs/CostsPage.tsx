import Link from "next/link";
import { ChevronLeft, ChevronRight, Cloud, Info, Receipt, Sparkles, Users, Video } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { AzureBill } from "@/lib/costs/azureBill";
import { PRICES_CHECKED } from "@/lib/costs/pricing";

type UsageRow = {
  id: string;
  at: string;
  service: string;
  feature: string;
  model: string | null;
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  quantity: number | null;
  costUsd: number | null;
  durationMs: number | null;
  userId: string | null;
  leadId: string | null;
  callId: string | null;
};

export type CostsData = {
  month: { key: string; prev: string; next: string | null };
  bill: AzureBill;
  storage: { recordings: number; bytes: number; perMonthUsd: number };
  events: UsageRow[];
  users: Record<string, string>;
  leads: Record<string, string>;
  calls: Record<string, { at: string; durationSec: number | null }>;
};

const FEATURES: Record<string, string> = {
  janus_ask: "Ask Janus",
  call_notes: "Video call notes",
  call_transcription: "Video call transcription",
  call_recording: "Video call recording",
  compose_message: "Compose message",
  meeting_prep: "Meeting prep",
  meeting_recap: "Meeting recap",
  focus_proposal: "Focus proposal",
  journal: "Journal",
  lead_proposal: "Lead proposal",
  daily_briefing: "Daily briefing",
  finance_chat: "Finance chat",
  document_reading: "Reading documents",
  janus: "Janus (other)",
};
const featureName = (f: string) => FEATURES[f] ?? f;

function money(n: number | null | undefined, currency = "USD") {
  if (n == null) return "—";
  const digits = n !== 0 && Math.abs(n) < 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
const mb = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`);
const minutes = (sec: number) => (sec < 60 ? `${Math.round(sec)}s` : `${(sec / 60).toFixed(1)} min`);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
const monthName = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const sum = (rows: UsageRow[], f: (r: UsageRow) => number | null | undefined) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-300";
const thR = `${th} text-right`;
const td = "px-3 py-2 text-ink-100";
const tdR = `${td} text-right tabular-nums`;

function Table({ head, children, empty }: { head: React.ReactNode; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead className="border-b border-base-700">{head}</thead>
        <tbody className="divide-y divide-base-800">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-6 text-center text-xs text-ink-300">Nothing recorded this month yet.</p>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <p className="text-xs text-ink-300">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-50">{value}</p>
      <p className="mt-1 text-[11px] text-ink-300">{hint}</p>
    </div>
  );
}

function usageOf(r: UsageRow) {
  if (r.service === "llm") {
    const cached = r.cachedTokens ? ` (${num(r.cachedTokens)} cached)` : "";
    return `${num(r.inputTokens)} in${cached} · ${num(r.outputTokens)} out`;
  }
  if (r.service === "speech") return `${minutes(r.quantity ?? 0)} of audio`;
  if (r.service === "recording") return `${mb(r.quantity ?? 0)} stored`;
  return "—";
}

export function CostsPage({ data }: { data: CostsData }) {
  const { events, bill } = data;
  const llm = events.filter((e) => e.service === "llm");
  const speech = events.filter((e) => e.service === "speech");
  const llmCost = sum(llm, (r) => r.costUsd);
  const speechCost = sum(speech, (r) => r.costUsd);
  const unpriced = llm.filter((r) => r.costUsd == null);

  // Janus by feature
  const byFeature = new Map<string, UsageRow[]>();
  for (const r of llm) byFeature.set(r.feature, [...(byFeature.get(r.feature) ?? []), r]);
  const features = [...byFeature.entries()].sort((a, b) => sum(b[1], (r) => r.costUsd) - sum(a[1], (r) => r.costUsd));

  // By person (everything metered)
  const byUser = new Map<string, UsageRow[]>();
  for (const r of events) {
    const k = r.userId ?? "";
    byUser.set(k, [...(byUser.get(k) ?? []), r]);
  }
  const people = [...byUser.entries()].sort((a, b) => sum(b[1], (r) => r.costUsd) - sum(a[1], (r) => r.costUsd));

  // Video calls
  const byCall = new Map<string, UsageRow[]>();
  for (const r of events) if (r.callId) byCall.set(r.callId, [...(byCall.get(r.callId) ?? []), r]);
  const calls = [...byCall.entries()].sort(
    (a, b) => Date.parse(data.calls[b[0]]?.at ?? b[1][0].at) - Date.parse(data.calls[a[0]]?.at ?? a[1][0].at)
  );

  const recent = events.slice(0, 300);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-300">Internal</p>
          <h1 className="font-display text-2xl font-semibold text-ink-50">Costs</h1>
        </div>
        <nav className="flex items-center gap-1 rounded-lg border border-base-700 bg-base-900 p-1 text-sm">
          <Link href={`?month=${data.month.prev}`} className="rounded-md p-1.5 text-ink-300 transition-colors hover:bg-base-800 hover:text-ink-50" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[9rem] px-2 text-center font-medium text-ink-50">{monthName(data.month.key)}</span>
          {data.month.next ? (
            <Link href={`?month=${data.month.next}`} className="rounded-md p-1.5 text-ink-300 transition-colors hover:bg-base-800 hover:text-ink-50" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="p-1.5 text-base-600"><ChevronRight className="h-4 w-4" /></span>
          )}
        </nav>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Azure bill"
          value={bill.state === "ok" ? money(bill.total, bill.currency) : "—"}
          hint={bill.state === "ok" ? "Actual, everything on the subscription" : "Not connected yet (see below)"}
        />
        <Stat label="Janus (AI)" value={money(llmCost)} hint={`${num(llm.length)} requests · estimate`} />
        <Stat label="Speech to text" value={money(speechCost)} hint={`${minutes(sum(speech, (r) => r.quantity))} of call audio · estimate`} />
        <Stat
          label="Recordings stored"
          value={`${money(data.storage.perMonthUsd)}/mo`}
          hint={`${num(data.storage.recordings)} files · ${mb(data.storage.bytes)} · if all in Hot`}
        />
      </div>

      <WidgetCard title="Azure bill by resource" icon={Receipt}>
        {bill.state === "ok" ? (
          <>
            <Table
              empty={!bill.lines.length}
              head={
                <tr>
                  <th className={th}>Resource</th>
                  <th className={th}>Service</th>
                  <th className={th}>Resource group</th>
                  <th className={thR}>Cost</th>
                </tr>
              }
            >
              {bill.lines.map((l, i) => (
                <tr key={i}>
                  <td className={td}>
                    <span className="font-medium text-ink-50">{l.resource}</span>
                    {l.resourceType && <span className="ml-2 text-ink-300">{l.resourceType}</span>}
                  </td>
                  <td className={td}>{l.service}</td>
                  <td className={`${td} text-ink-300`}>{l.resourceGroup}</td>
                  <td className={tdR}>{money(l.cost, bill.currency)}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-[11px] text-ink-300">
              From Azure Cost Management. Azure updates this a few times a day, so today&apos;s usage shows up later.
            </p>
          </>
        ) : bill.state === "not_configured" ? (
          <div className="space-y-2 text-xs text-ink-300">
            <p className="text-ink-100">Connect the real Azure bill (one-time, done in the Azure portal):</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Subscriptions → the subscription → Access control (IAM) → Add role assignment.</li>
              <li>Role: <span className="text-ink-50">Cost Management Reader</span>. Member: Sphaera&apos;s sign-in app registration.</li>
              <li>Add the app setting <span className="font-mono text-ink-50">AZURE_COST_SUBSCRIPTION_ID</span> (the subscription ID) to the Static Web App.</li>
            </ol>
            <p>Missing now: {data.bill.state === "not_configured" && data.bill.missing.join(", ")}</p>
          </div>
        ) : (
          <p className="text-xs text-status-inactive">{bill.message}</p>
        )}
      </WidgetCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Janus by feature" icon={Sparkles}>
          <Table
            empty={!features.length}
            head={
              <tr>
                <th className={th}>Feature</th>
                <th className={thR}>Requests</th>
                <th className={thR}>Tokens in / out</th>
                <th className={thR}>Per request</th>
                <th className={thR}>Cost</th>
              </tr>
            }
          >
            {features.map(([f, rows]) => {
              const cost = sum(rows, (r) => r.costUsd);
              return (
                <tr key={f}>
                  <td className={td}>{featureName(f)}</td>
                  <td className={tdR}>{num(rows.length)}</td>
                  <td className={tdR}>
                    {num(sum(rows, (r) => r.inputTokens))} / {num(sum(rows, (r) => r.outputTokens))}
                  </td>
                  <td className={tdR}>{money(cost / rows.length)}</td>
                  <td className={tdR}>{money(cost)}</td>
                </tr>
              );
            })}
          </Table>
          {unpriced.length > 0 && (
            <p className="mt-3 text-[11px] text-status-inactive">
              {unpriced.length} requests used a model with no price set ({[...new Set(unpriced.map((r) => r.model))].join(", ")}); add it in lib/costs/pricing.ts.
            </p>
          )}
        </WidgetCard>

        <WidgetCard title="By person" icon={Users}>
          <Table
            empty={!people.length}
            head={
              <tr>
                <th className={th}>Person</th>
                <th className={thR}>Janus</th>
                <th className={thR}>Speech</th>
                <th className={thR}>Recording</th>
                <th className={thR}>Total</th>
              </tr>
            }
          >
            {people.map(([uid, rows]) => {
              const part = (s: string) => sum(rows.filter((r) => r.service === s), (r) => r.costUsd);
              return (
                <tr key={uid || "none"}>
                  <td className={td}>{uid ? data.users[uid] ?? "Unknown user" : "System"}</td>
                  <td className={tdR}>{money(part("llm"))}</td>
                  <td className={tdR}>{money(part("speech"))}</td>
                  <td className={tdR}>{money(part("recording"))}</td>
                  <td className={`${tdR} font-medium text-ink-50`}>{money(sum(rows, (r) => r.costUsd))}</td>
                </tr>
              );
            })}
          </Table>
        </WidgetCard>
      </div>

      <WidgetCard title="Video calls" icon={Video}>
        <Table
          empty={!calls.length}
          head={
            <tr>
              <th className={th}>Call</th>
              <th className={th}>Agent</th>
              <th className={thR}>Length</th>
              <th className={thR}>Transcription</th>
              <th className={thR}>Janus notes</th>
              <th className={thR}>Recording (1st month)</th>
              <th className={thR}>Total</th>
            </tr>
          }
        >
          {calls.map(([callId, rows]) => {
            const info = data.calls[callId];
            const pick = (s: string) => rows.filter((r) => r.service === s);
            const sp = pick("speech");
            const rec = pick("recording");
            const lead = rows.find((r) => r.leadId)?.leadId;
            const agent = rows.find((r) => r.userId)?.userId;
            return (
              <tr key={callId}>
                <td className={td}>
                  <Link href={`/video/${callId}`} className="font-medium text-ink-50 underline-offset-2 hover:underline">
                    {lead ? data.leads[lead] ?? "Lead" : "Call"}
                  </Link>
                  <span className="ml-2 text-ink-300">{when(info?.at ?? rows[0].at)}</span>
                </td>
                <td className={td}>{agent ? data.users[agent] ?? "—" : "—"}</td>
                <td className={tdR}>{info?.durationSec ? minutes(info.durationSec) : "—"}</td>
                <td className={tdR}>
                  {sp.length ? `${money(sum(sp, (r) => r.costUsd))} · ${minutes(sum(sp, (r) => r.quantity))}` : "—"}
                </td>
                <td className={tdR}>{money(sum(pick("llm"), (r) => r.costUsd))}</td>
                <td className={tdR}>{rec.length ? `${money(sum(rec, (r) => r.costUsd))} · ${mb(sum(rec, (r) => r.quantity))}` : "—"}</td>
                <td className={`${tdR} font-medium text-ink-50`}>{money(sum(rows, (r) => r.costUsd))}</td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-3 text-[11px] text-ink-300">
          Since 13 Nov 2026 each call's voices are mixed into one stream, so a 10-minute call is billed as 10 minutes of audio (earlier calls: one stream per person). The video server (VM) is a fixed monthly cost and appears in the Azure bill above.
        </p>
      </WidgetCard>

      <WidgetCard title="Every request" icon={Cloud}>
        <Table
          empty={!recent.length}
          head={
            <tr>
              <th className={th}>When</th>
              <th className={th}>What</th>
              <th className={th}>Who</th>
              <th className={th}>For</th>
              <th className={th}>Usage</th>
              <th className={thR}>Took</th>
              <th className={thR}>Cost</th>
            </tr>
          }
        >
          {recent.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap text-ink-300`}>{when(r.at)}</td>
              <td className={td}>
                {featureName(r.feature)}
                {r.model && <span className="ml-1.5 text-ink-300">{r.model}</span>}
              </td>
              <td className={td}>{r.userId ? data.users[r.userId] ?? "—" : "System"}</td>
              <td className={td}>
                {r.callId ? (
                  <Link href={`/video/${r.callId}`} className="underline-offset-2 hover:underline">
                    {r.leadId ? data.leads[r.leadId] ?? "Call" : "Call"}
                  </Link>
                ) : r.leadId ? (
                  <Link href={`/leads/${r.leadId}`} className="underline-offset-2 hover:underline">
                    {data.leads[r.leadId] ?? "Lead"}
                  </Link>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{usageOf(r)}</td>
              <td className={tdR}>{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</td>
              <td className={`${tdR} font-medium text-ink-50`}>{money(r.costUsd)}</td>
            </tr>
          ))}
        </Table>
        {events.length > recent.length && (
          <p className="mt-3 text-[11px] text-ink-300">Showing the latest {recent.length} of {num(events.length)}.</p>
        )}
      </WidgetCard>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-300">
        <Info className="h-3 w-3 shrink-0" />
        Per-request costs are estimates from Azure list prices (checked {PRICES_CHECKED}). The Azure bill is the real total.
        Tracking started 13 Nov 2026; earlier requests aren&apos;t counted.
      </p>
    </div>
  );
}
