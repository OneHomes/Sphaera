"use client";

import { useState } from "react";
import { Network, ClipboardCheck, Landmark, ShieldCheck, Workflow, Pencil } from "lucide-react";
import Link from "next/link";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { ERP_REGIONS, ERP_ENVIRONMENTS, ERP_INTEGRATION_MODES } from "@/lib/finance/erpRegistryData";

type ErpSource = {
  id: string;
  name: string;
  region: string | null;
  legalEntity: string | null;
  environment: string | null;
  integrationMode: string | null;
  endpointUrl: string | null;
  active: boolean;
  stagedCount: number;
  pendingCount: number;
  status: "Awaiting IT integration" | "Inactive";
};

type FundSummaryRow = {
  sourceId: string;
  region: string | null;
  sourceName: string;
  currency: string;
  fund: string;
  amount: number;
  movementCount: number;
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

const DATA_FLOW_STEPS = [
  "IT confirms a read-only connection (C# API or SQL Server bridge) for the regional ERP and shares the endpoint with Finance.",
  "Finance registers the ERP source here, tagging it to its home region (Pakistan, UAE or UK & USA) and legal entity.",
  "IT exposes the fund-allocation fields (S&M / Development / Unallocated) on every receipt and payment pulled from that ERP.",
  "Finance reviews and approves each ERP transaction's fund allocation before it reaches the treasury ledger.",
  "Approved allocations flow into the Treasury Funds screen, grouped by ERP, bank, entity, currency and fund.",
];

export function ErpConnectionsPage({
  sources: initialSources,
  fundSummary,
}: {
  sources: ErpSource[];
  fundSummary: FundSummaryRow[];
}) {
  const [sources, setSources] = useState<ErpSource[]>(initialSources);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState<string>(ERP_REGIONS[0]);
  const [legalEntity, setLegalEntity] = useState("");
  const [environment, setEnvironment] = useState<string>(ERP_ENVIRONMENTS[0]);
  const [integrationMode, setIntegrationMode] = useState<string>(ERP_INTEGRATION_MODES[0]);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setRegion(ERP_REGIONS[0]);
    setLegalEntity("");
    setEnvironment(ERP_ENVIRONMENTS[0]);
    setIntegrationMode(ERP_INTEGRATION_MODES[0]);
    setEndpointUrl("");
    setActive(true);
    setError(null);
  }

  function startEdit(source: ErpSource) {
    setEditingId(source.id);
    setName(source.name);
    setRegion(source.region ?? ERP_REGIONS[0]);
    setLegalEntity(source.legalEntity ?? "");
    setEnvironment(source.environment ?? ERP_ENVIRONMENTS[0]);
    setIntegrationMode(source.integrationMode ?? ERP_INTEGRATION_MODES[0]);
    setEndpointUrl(source.endpointUrl ?? "");
    setActive(source.active);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/erp/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name,
          region,
          legalEntity,
          environment,
          integrationMode,
          endpointUrl,
          active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save ERP source");

      const submitted = { name, region, legalEntity, environment, integrationMode, endpointUrl, active };
      setSources((prev) => {
        const existing = prev.find((s) => s.id === data.id);
        if (existing) {
          return prev.map((s) => (s.id === data.id ? { ...s, ...submitted } : s));
        }
        return [
          ...prev,
          { ...submitted, id: data.id, stagedCount: 0, pendingCount: 0, status: active ? "Awaiting IT integration" : "Inactive" },
        ];
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = sources.filter((s) => s.active).length;

  const fundRowsByRegion = new Map<string, FundSummaryRow[]>();
  for (const row of fundSummary) {
    const key = row.region ?? "Unassigned";
    if (!fundRowsByRegion.has(key)) fundRowsByRegion.set(key, []);
    fundRowsByRegion.get(key)!.push(row);
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Three regional ERP systems</h2>
        <p className="mt-1 text-sm text-ink-500">
          All three are developed by the same supplier but are separate databases. ERP location is not a fund or
          department. Finance tags each receipt or payment as S&amp;M, Development or Unallocated inside its
          originating ERP.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Regional ERPs" icon={Network}>
          <Tile label="Separate installations" value="3" />
        </WidgetCard>
        <WidgetCard title="Active registrations" icon={ClipboardCheck}>
          <Tile label="Registered and active" value={activeCount.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Fund types" icon={Landmark}>
          <Tile label="S&amp;M and Development" value="2" />
        </WidgetCard>
        <WidgetCard title="Tagging authority" icon={ShieldCheck}>
          <Tile label="Who classifies each transaction" value="Finance" />
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {ERP_REGIONS.map((reg) => {
          const regSources = sources.filter((s) => s.region === reg);
          const rows = fundRowsByRegion.get(reg) ?? [];
          return (
            <WidgetCard key={reg} title={reg} icon={Network}>
              <Tile label="Registered sources" value={regSources.length.toLocaleString()} />
              <p className="mt-3 text-[11px] text-ink-500">Finance tags each transaction as it is reviewed inside this ERP.</p>
              <div className="mt-2 space-y-1">
                {rows.length === 0 ? (
                  <p className="text-[11px] text-ink-600">No ERP fund-tagged movements received yet.</p>
                ) : (
                  rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-ink-300">
                      <span>{r.fund}</span>
                      <span className="text-ink-50">
                        {r.currency} {r.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </WidgetCard>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-base-700 bg-base-900 p-3 text-[11px] text-ink-500">
        <span className="font-medium text-ink-300">How funds are reported: </span>
        A Pakistan ERP receipt could be 100% Development, 100% S&amp;M, or split between both. The same applies to
        UAE and UK &amp; USA. The dashboard reads the approved allocations and groups them by ERP, bank, entity,
        currency and fund. Unallocated balances are never shown as spendable fund cash.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title={editingId ? "Edit ERP registration" : "Register ERP source"} icon={Network}>
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ERP name" className={inputClass} />
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
              {ERP_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={inputClass}>
                {ERP_ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
              <input
                value={legalEntity}
                onChange={(e) => setLegalEntity(e.target.value)}
                placeholder="Legal entity"
                className={inputClass}
              />
            </div>
            <select value={integrationMode} onChange={(e) => setIntegrationMode(e.target.value)} className={inputClass}>
              {ERP_INTEGRATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://... API base URL (optional, no credentials)"
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
            <p className="text-[10px] text-ink-600">
              This registry stores non-secret connection metadata only. No live ERP connection is made here — never
              enter SQL passwords or API secrets.
            </p>
            {error && <p className="text-xs text-status-inactive">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !name.trim() || !region}
                className="flex-1 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Register source"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-base-800"
              >
                Clear
              </button>
            </div>
          </form>
        </WidgetCard>

        <WidgetCard title="IT and Finance data flow" icon={Workflow}>
          <ol className="space-y-2 text-xs text-ink-300">
            {DATA_FLOW_STEPS.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-medium text-ink-50">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-ink-500">
            IT must expose the fund-allocation fields on every ERP transaction before fund reporting can begin.
          </p>
          <Link href="/finance/banks/funds" className="mt-2 inline-block text-[11px] text-ink-300 hover:text-ink-50">
            Open Treasury Funds ↗
          </Link>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="ERP registrations" icon={ClipboardCheck}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s) => (
              <div key={s.id} className="rounded-lg border border-base-700 bg-base-800 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-base-700 px-2 py-0.5 text-[10px] font-medium text-ink-300">
                    {s.region ?? "Unassigned"}
                  </span>
                  <span className="rounded-full bg-base-700 px-2 py-0.5 text-[10px] font-medium text-ink-300">
                    {s.environment ?? "—"}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      s.active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink-50">{s.name}</p>
                <p className="mt-1 text-[11px] text-ink-500">{s.legalEntity || "No legal entity set"}</p>
                <p className="mt-1 text-[11px] text-ink-500">{s.integrationMode ?? "No integration mode set"}</p>
                <p className="mt-1 truncate text-[11px] text-ink-600" title={s.endpointUrl ?? ""}>
                  {s.endpointUrl || "No endpoint configured"}
                </p>
                <p className="mt-1 text-[11px] text-ink-500">
                  {s.stagedCount} staged / {s.pendingCount} pending
                </p>
                {!s.region && (
                  <p className="mt-1.5 text-[11px] font-medium text-status-alert">Set region before integrating</p>
                )}
                <button
                  onClick={() => startEdit(s)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-ink-300 hover:text-ink-50"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.75} /> Edit
                </button>
              </div>
            ))}
            {sources.length === 0 && <p className="text-xs text-ink-500">No ERP sources registered yet.</p>}
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
