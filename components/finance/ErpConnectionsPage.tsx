"use client";

import { useState } from "react";
import { Network, Plug, Inbox, Landmark, Plus, X } from "lucide-react";
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

type StagingRecord = {
  id: string;
  sourceId: string;
  externalId: string;
  rawJson: string;
  status: string;
  receivedAt: string | Date;
  matchedTransactionId: string | null;
};

type ErpStatus = {
  connected: boolean;
  connector: string;
  unmatched: StagingRecord[];
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

type BankBalance = {
  id: string;
  externalAccountId: string;
  asOf: string | Date;
  institution: string | null;
  accountLabel: string | null;
  legalEntity: string | null;
  currency: string | null;
  ledgerBalance: number | null;
  availableBalance: number | null;
  erpReference: string | null;
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function SourceModal({
  source,
  initialRegion,
  onClose,
  onSaved,
}: {
  source: ErpSource | null;
  initialRegion?: string;
  onClose: () => void;
  onSaved: (result: { id: string; status: string }, submitted: Omit<ErpSource, "stagedCount" | "pendingCount" | "status">) => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [region, setRegion] = useState(source?.region ?? initialRegion ?? ERP_REGIONS[0]);
  const [legalEntity, setLegalEntity] = useState(source?.legalEntity ?? "");
  const [environment, setEnvironment] = useState(source?.environment ?? ERP_ENVIRONMENTS[0]);
  const [integrationMode, setIntegrationMode] = useState(source?.integrationMode ?? ERP_INTEGRATION_MODES[0]);
  const [endpointUrl, setEndpointUrl] = useState(source?.endpointUrl ?? "");
  const [active, setActive] = useState(source?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/erp/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source?.id,
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
      onSaved(data, { id: source?.id ?? data.id, name, region, legalEntity, environment, integrationMode, endpointUrl, active });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{source ? "Edit ERP Source" : "Register ERP Source"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ERP name" className={inputClass} />
          <select value={region ?? ""} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
            {ERP_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            value={legalEntity}
            onChange={(e) => setLegalEntity(e.target.value)}
            placeholder="Legal entity (optional)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <select value={environment ?? ""} onChange={(e) => setEnvironment(e.target.value)} className={inputClass}>
              {ERP_ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
            <select value={integrationMode ?? ""} onChange={(e) => setIntegrationMode(e.target.value)} className={inputClass}>
              {ERP_INTEGRATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <input
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://... (optional, no credentials)"
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
          <button
            type="submit"
            disabled={saving || !name.trim() || !region}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : source ? "Save changes" : "Register source"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ErpConnectionsPage({
  sources: initialSources,
  status: initialStatus,
  fundSummary,
  bankBalances,
}: {
  sources: ErpSource[];
  status: ErpStatus;
  fundSummary: FundSummaryRow[];
  bankBalances: BankBalance[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [status, setStatus] = useState(initialStatus);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ErpSource | null>(null);
  const [createRegion, setCreateRegion] = useState<string | undefined>(undefined);
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<Record<string, string>>({});

  function openCreate() {
    setEditingSource(null);
    setCreateRegion(undefined);
    setModalOpen(true);
  }
  function openEdit(source: ErpSource) {
    setEditingSource(source);
    setCreateRegion(undefined);
    setModalOpen(true);
  }
  function openCreateForRegion(region: string) {
    setEditingSource(null);
    setCreateRegion(region);
    setModalOpen(true);
  }

  function handleSaved(result: { id: string; status: string }, submitted: Omit<ErpSource, "stagedCount" | "pendingCount" | "status">) {
    setSources((prev) => {
      const existing = prev.find((s) => s.id === result.id);
      if (existing) {
        return prev.map((s) => (s.id === result.id ? { ...s, ...submitted } : s));
      }
      return [
        ...prev,
        { ...submitted, id: result.id, stagedCount: 0, pendingCount: 0, status: submitted.active ? "Awaiting IT integration" : "Inactive" },
      ];
    });
    setModalOpen(false);
  }

  async function resolveItem(stagedId: string) {
    const transactionId = (resolveDrafts[stagedId] ?? "").trim();
    if (!transactionId) {
      setResolveError((prev) => ({ ...prev, [stagedId]: "Enter a payment ID to link" }));
      return;
    }
    setResolving(stagedId);
    setResolveError((prev) => ({ ...prev, [stagedId]: "" }));
    try {
      const res = await fetch("/api/finance/erp/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagedId, transactionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to resolve");
      setStatus((prev) => ({ ...prev, unmatched: prev.unmatched.filter((u) => u.id !== stagedId) }));
    } catch (err) {
      setResolveError((prev) => ({ ...prev, [stagedId]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">ERP Connections</h1>
          <p className="mt-1 text-sm text-ink-500">
            Registry of One Homes&apos; regional ERP installations — manual staging and review, no live connections
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Register ERP source
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Registered sources" value={sources.length.toLocaleString()} />
        <Tile label="Staged records awaiting match" value={status.unmatched.length.toLocaleString()} />
        <Tile label="Connector status" value={status.connected ? "Connected" : "Not configured"} />
      </div>

      <div className="mt-4">
        <WidgetCard title="Regional ERP Sources" icon={Network}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Region</th>
                  <th className="px-2 py-1.5">Environment</th>
                  <th className="px-2 py-1.5">Integration</th>
                  <th className="px-2 py-1.5">Staged / Pending</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {ERP_REGIONS.map((region) => {
                  const regionSources = sources.filter((s) => s.region === region);
                  if (regionSources.length === 0) {
                    return (
                      <tr key={region} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-2 py-1.5 text-ink-500" colSpan={6}>
                          {region} — not registered yet
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => openCreateForRegion(region)}
                            className="text-[11px] font-medium text-ink-300 hover:text-ink-50"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  return regionSources.map((s) => (
                    <tr key={s.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-2 py-1.5">{s.name}</td>
                      <td className="px-2 py-1.5">{s.region}</td>
                      <td className="px-2 py-1.5">{s.environment}</td>
                      <td className="px-2 py-1.5">{s.integrationMode}</td>
                      <td className="px-2 py-1.5">
                        {s.stagedCount} / {s.pendingCount}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            s.active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => openEdit(s)} className="text-[11px] font-medium text-ink-300 hover:text-ink-50">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Connector Status" icon={Plug}>
          <p className="text-xs text-ink-300">{status.connector}</p>
          <p className="mt-2 text-[11px] text-ink-500">
            {status.connected ? "A live connector is configured." : "No live inbound ERP connector is configured yet."}
          </p>
          {fundSummary.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                Pending fund movements awaiting treasury posting
              </p>
              <div className="overflow-x-auto rounded-lg border border-base-700">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-2 py-1.5">Region</th>
                      <th className="px-2 py-1.5">Source</th>
                      <th className="px-2 py-1.5">Fund</th>
                      <th className="px-2 py-1.5">Currency</th>
                      <th className="px-2 py-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundSummary.map((r, i) => (
                      <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-2 py-1">{r.region ?? "—"}</td>
                        <td className="px-2 py-1">{r.sourceName}</td>
                        <td className="px-2 py-1">{r.fund}</td>
                        <td className="px-2 py-1">{r.currency}</td>
                        <td className="px-2 py-1">{r.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="Unmatched Staging Items" icon={Inbox}>
          {status.unmatched.length === 0 ? (
            <p className="text-xs text-ink-500">No staged ERP records are waiting for manual matching.</p>
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {status.unmatched.map((item) => (
                <div key={item.id} className="rounded-lg border border-base-700 bg-base-800 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-ink-300">
                    <span className="truncate" title={item.externalId}>
                      External ID: {item.externalId}
                    </span>
                    <span className="shrink-0 text-ink-500">{new Date(item.receivedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={resolveDrafts[item.id] ?? ""}
                      onChange={(e) => setResolveDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Matching payment ID"
                      className="w-full rounded-md border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-ink-50 outline-none placeholder:text-ink-500"
                    />
                    <button
                      onClick={() => resolveItem(item.id)}
                      disabled={resolving === item.id}
                      className="shrink-0 rounded-md bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-base-950 hover:bg-white disabled:opacity-50"
                    >
                      {resolving === item.id ? "Resolving…" : "Resolve"}
                    </button>
                  </div>
                  {resolveError[item.id] && <p className="mt-1 text-[11px] text-status-inactive">{resolveError[item.id]}</p>}
                </div>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      {bankBalances.length > 0 && (
        <div className="mt-4">
          <WidgetCard title="Latest ERP Bank Balances" icon={Landmark}>
            <div className="overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-2 py-1.5">Legal entity</th>
                    <th className="px-2 py-1.5">Institution</th>
                    <th className="px-2 py-1.5">Account</th>
                    <th className="px-2 py-1.5">As of</th>
                    <th className="px-2 py-1.5">Ledger balance</th>
                    <th className="px-2 py-1.5">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {bankBalances.map((b) => (
                    <tr key={b.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-2 py-1.5">{b.legalEntity ?? "—"}</td>
                      <td className="px-2 py-1.5">{b.institution ?? "—"}</td>
                      <td className="px-2 py-1.5">{b.accountLabel ?? b.externalAccountId}</td>
                      <td className="px-2 py-1.5">{new Date(b.asOf).toLocaleDateString()}</td>
                      <td className="px-2 py-1.5">
                        {b.ledgerBalance != null ? `${b.currency ?? ""} ${b.ledgerBalance.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {b.availableBalance != null ? `${b.currency ?? ""} ${b.availableBalance.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        </div>
      )}

      {modalOpen && (
        <SourceModal source={editingSource} initialRegion={createRegion} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
