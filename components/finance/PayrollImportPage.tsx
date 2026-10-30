"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { LIST_PAGE, ListSearch, ShowMoreBar, useListSearch, useShowMore } from "./ShowMore";
import { confirmDialog } from "./dialogs";

// People Costs skill: payroll master CSV -> controlled review workbook -> reviewed import ->
// Finance approval -> reconciliation against person allocations on real ledger payments.
// Payroll master amounts are claims, never ledger expenses; nothing here posts to the ledger.

type RunSummary = {
  id: string;
  sourceName: string;
  payPeriod: string | null;
  status: string;
  employeeCount: number;
  fxPkrPerUsd: number;
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

type Line = {
  id: string;
  personId: string | null;
  csvRow: number;
  employeeName: string;
  sourceDepartment: string | null;
  approvedDepartment: string | null;
  designation: string | null;
  employmentStatus: string | null;
  currency: "USD" | "PKR";
  baseSalary: number;
  transportAllowance: number;
  bookingsCommission: number;
  dealClosedCommission: number;
  sourcePayable: number;
  sourceComments: string | null;
  reviewNote: string | null;
  componentSum: number;
  variance: number;
  usdEquivalent: number;
};

type RunDetail = Omit<RunSummary, "employeeCount"> & {
  lines: Line[];
  sourceTotals: { csvRow: number; label: string; usd: number | null; pkr: number | null }[];
  exceptions: { csvRow: number | null; subject: string; issue: string; currency: string | null; components: number | null; sourcePayable: number | null; variance: number | null; evidence: string | null }[];
  reconciliation: null | {
    month: string;
    rows: { employeeName: string; department: string | null; masterUsdEquivalent: number; attributedUsd: number; difference: number; status: string }[];
    notOnMaster: { personId: string; employeeName: string; attributedUsd: number }[];
    totals: { masterUsdEquivalent: number; attributedUsd: number };
  };
};

const TABS = ["People Costs", "Department Summary", "Exceptions", "Source Totals", "Reconciliation"] as const;

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number, c: "USD" | "PKR") => (c === "USD" ? `$${num(n)}` : `Rs ${num(n)}`);

async function download(url: string, init: RequestInit | undefined, fallbackName: string) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

function Kpi({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      {detail && <div className="mt-1 text-[11px] text-ink-500">{detail}</div>}
    </div>
  );
}

const btn = "rounded-md border border-base-600 bg-base-800 px-3 py-1.5 text-xs text-ink-50 hover:bg-base-700 disabled:opacity-50";
const btnPrimary = "rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50";
const input = "rounded-md border border-base-600 bg-base-800 px-2 py-1 text-xs text-ink-50";
const th = "px-2 py-2 text-left font-medium text-ink-500 whitespace-nowrap";
const td = "px-2 py-1.5 text-ink-300 whitespace-nowrap";
const tdNum = "px-2 py-1.5 text-right tabular-nums text-ink-300 whitespace-nowrap";

export function PayrollImportPage({ initialRuns, departments }: { initialRuns: RunSummary[]; departments: string[] }) {
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns);
  const [selectedId, setSelectedId] = useState<string | null>(initialRuns[0]?.id ?? null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("People Costs");
  const [edits, setEdits] = useState<Record<string, { approvedDepartment?: string | null; reviewNote?: string | null }>>({});
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);

  const refreshRuns = useCallback(async () => {
    const res = await fetch("/api/finance/payroll/runs");
    if (res.ok) setRuns(await res.json());
  }, []);

  const loadRun = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/payroll/runs/${id}`);
    if (!res.ok) return setMessage({ kind: "error", text: "Could not load the payroll run." });
    const data: RunDetail = await res.json();
    setRun(data);
    setPeriod(data.payPeriod ?? "");
    setEdits({});
  }, []);

  useEffect(() => {
    if (selectedId) loadRun(selectedId);
    else setRun(null);
  }, [selectedId, loadRun]);

  async function act(label: string, fn: () => Promise<string | void>) {
    setBusy(label);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ kind: "ok", text });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function json(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
    return body;
  }

  const generateWorkbook = (file: File) =>
    act("generate", async () => {
      const fd = new FormData();
      fd.append("file", file);
      await download("/api/finance/payroll/workbook", { method: "POST", body: fd }, "Sphaera_People_Costs.xlsx");
      return "Review workbook generated. Finance reviews Exceptions and approves a department for every row, then imports it below.";
    });

  const importFile = (file: File) =>
    act("import", async () => {
      const fd = new FormData();
      fd.append("file", file);
      const body = await json("/api/finance/payroll/runs", { method: "POST", body: fd });
      await refreshRuns();
      setSelectedId(body.id);
      return `Imported ${body.employees} employee rows as a draft payroll run.`;
    });

  const isDraft = run?.status === "Draft";
  const lineValue = (l: Line) => ({ ...l, ...edits[l.id] });
  const dirtyCount = Object.keys(edits).length + (run && (period || null) !== run.payPeriod ? 1 : 0);

  const saveDraft = () =>
    act("save", async () => {
      if (!run) return;
      await json(`/api/finance/payroll/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payPeriod: (period || null) !== run.payPeriod ? period || null : undefined,
          lines: Object.entries(edits).map(([id, e]) => ({ id, ...e })),
        }),
      });
      await Promise.all([loadRun(run.id), refreshRuns()]);
      return "Draft saved.";
    });

  const approve = () =>
    act("approve", async () => {
      if (!run) return;
      if (dirtyCount) throw new Error("Save your changes before approving.");
      if (
        !(await confirmDialog(
          `Approve payroll run for ${run.payPeriod}? Employees will be linked to People records with their approved departments. Approved runs are locked. This does not post anything to the ledger.`,
          { title: "Approve payroll run", confirmLabel: "Approve" }
        ))
      )
        return;
      const body = await json(`/api/finance/payroll/runs/${run.id}/approve`, { method: "POST" });
      await Promise.all([loadRun(run.id), refreshRuns()]);
      return `Approved. ${body.linked} employees linked to People records.`;
    });

  const remove = () =>
    act("delete", async () => {
      if (!run || !(await confirmDialog("Delete this draft payroll run?", { title: "Delete draft", confirmLabel: "Delete", danger: true }))) return;
      await json(`/api/finance/payroll/runs/${run.id}`, { method: "DELETE" });
      await refreshRuns();
      setSelectedId(null);
      return "Draft deleted.";
    });

  const stats = useMemo(() => {
    if (!run) return null;
    const lines = run.lines.map(lineValue);
    const usd = lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.sourcePayable, 0);
    const pkr = lines.filter((l) => l.currency === "PKR").reduce((s, l) => s + l.sourcePayable, 0);
    const review = lines.filter((l) => Math.abs(l.variance) > 0.009 || !l.approvedDepartment).length;
    const variances = lines.filter((l) => Math.abs(l.variance) > 0.009).length;
    return { lines, usd, pkr, usdEq: usd + pkr / run.fxPkrPerUsd, review, variances };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, edits]);

  const deptSummary = useMemo(() => {
    if (!stats || !run) return [];
    const rows = [...departments, ""].map((d) => {
      const ls = stats.lines.filter((l) => (l.approvedDepartment ?? "") === d);
      const usd = ls.filter((l) => l.currency === "USD").reduce((s, l) => s + l.sourcePayable, 0);
      const pkr = ls.filter((l) => l.currency === "PKR").reduce((s, l) => s + l.sourcePayable, 0);
      return { department: d || "Unmapped (blank)", employees: ls.length, usd, pkr, usdEq: usd + pkr / run.fxPkrPerUsd, review: ls.filter((l) => Math.abs(l.variance) > 0.009 || !l.approvedDepartment).length };
    });
    return rows.filter((r) => r.employees > 0);
  }, [stats, run, departments]);

  // Lists show 10 at a time (Show more). Lists without a filter of their own get a small search.
  const runSearch = useListSearch(runs, (r) => [r.payPeriod, r.sourceName, r.status, r.createdBy, r.approvedBy]);
  const runMore = useShowMore(runSearch.filtered, `${runs.length}|${runSearch.query}`);

  // Payroll master already has its "Review rows only" toggle. The reset key leaves out the row count so
  // approving a department (which can drop a row out of "review only") doesn't collapse the list mid-edit.
  const masterLines = useMemo(
    () => (stats ? stats.lines.filter((l) => !onlyReview || Math.abs(l.variance) > 0.009 || !l.approvedDepartment) : []),
    [stats, onlyReview]
  );
  const masterMore = useShowMore(masterLines, `${run?.id ?? ""}|${onlyReview}`);

  const deptSearch = useListSearch(deptSummary, (r) => [r.department]);
  const deptMore = useShowMore(deptSearch.filtered, `${run?.id ?? ""}|${deptSearch.query}`);

  const exceptionSearch = useListSearch(run?.exceptions ?? [], (e) => [e.csvRow, e.subject, e.issue, e.currency, e.evidence]);
  const exceptionMore = useShowMore(exceptionSearch.filtered, `${run?.id ?? ""}|${run?.exceptions.length ?? 0}|${exceptionSearch.query}`);

  // Reconciliation: matched rows and "not on payroll master" rows as one list so both page together.
  const reconRows = useMemo(() => {
    const rec = run?.reconciliation;
    if (!rec) return [];
    return [
      ...rec.rows.map((r, i) => ({ key: `row-${i}`, employeeName: r.employeeName, department: r.department, master: r.masterUsdEquivalent as number | null, attributed: r.attributedUsd, difference: r.difference, status: r.status, notOnMaster: false })),
      ...rec.notOnMaster.map((r) => ({ key: r.personId, employeeName: r.employeeName, department: null as string | null, master: null as number | null, attributed: r.attributedUsd, difference: r.attributedUsd, status: "Not on payroll master", notOnMaster: true })),
    ];
  }, [run]);
  const reconSearch = useListSearch(reconRows, (r) => [r.employeeName, r.department, r.status]);
  const reconMore = useShowMore(reconSearch.filtered, `${run?.id ?? ""}|${reconRows.length}|${reconSearch.query}`);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-ink-50">Payroll Import</h2>
        <p className="mt-1 max-w-4xl text-xs text-ink-500">
          Turn the HR payroll master into a controlled review workbook, import it back after Finance review, approve departments
          and reconcile against person allocations on actual ledger payments. Payroll master amounts are claims, not paid spend,
          and are never posted to the ledger. CNIC, bank account and routing details are never read or stored.
        </p>
      </div>

      {message && (
        <div className={`rounded-md border px-3 py-2 text-xs ${message.kind === "ok" ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-red-800 bg-red-950/40 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title="1. Generate review workbook">
          <p className="mb-3 text-xs text-ink-500">
            Upload the payroll master CSV. Sphaera returns a 7-sheet workbook: Control, People Costs, Department Summary,
            Exceptions and Source Totals, with approved-department dropdowns. Nothing is saved.
          </p>
          <label className={btn + " inline-block cursor-pointer"}>
            {busy === "generate" ? "Generating…" : "Choose payroll CSV"}
            <input type="file" accept=".csv,text/csv" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) generateWorkbook(f); }} />
          </label>
        </WidgetCard>
        <WidgetCard title="2. Import for approval">
          <p className="mb-3 text-xs text-ink-500">
            Upload the reviewed workbook (.xlsx) or the CSV directly. It becomes a draft run: confirm the pay period, approve a
            department for every row and add a review note to each pay discrepancy, then approve.
          </p>
          <label className={btn + " inline-block cursor-pointer"}>
            {busy === "import" ? "Importing…" : "Choose reviewed workbook or CSV"}
            <input type="file" accept=".xlsx,.csv" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importFile(f); }} />
          </label>
        </WidgetCard>
      </div>

      <WidgetCard
        title="Payroll runs"
        action={runs.length > LIST_PAGE ? <ListSearch value={runSearch.query} onChange={runSearch.setQuery} placeholder="Filter runs…" /> : undefined}
      >
        {runs.length === 0 ? (
          <p className="text-xs text-ink-500">No payroll runs imported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-base-700">
                <tr><th className={th}>Pay period</th><th className={th}>Source</th><th className={th}>Employees</th><th className={th}>Status</th><th className={th}>Imported</th><th className={th}>Approved</th></tr>
              </thead>
              <tbody>
                {runMore.visible.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} className={`cursor-pointer border-b border-base-800 hover:bg-base-800 ${r.id === selectedId ? "bg-base-800" : ""}`}>
                    <td className={td}>{r.payPeriod ?? <span className="text-amber-400">Not confirmed</span>}</td>
                    <td className={td}>{r.sourceName}</td>
                    <td className={tdNum}>{r.employeeCount}</td>
                    <td className={td}><span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "Approved" ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/50 text-amber-300"}`}>{r.status}</span></td>
                    <td className={td}>{new Date(r.createdAt).toLocaleDateString("en-GB")} · {r.createdBy}</td>
                    <td className={td}>{r.approvedAt ? `${new Date(r.approvedAt).toLocaleDateString("en-GB")} · ${r.approvedBy}` : "—"}</td>
                  </tr>
                ))}
                {!runSearch.filtered.length && <tr><td className={td} colSpan={6}>No runs match.</td></tr>}
              </tbody>
            </table>
            <ShowMoreBar state={runMore} />
          </div>
        )}
      </WidgetCard>

      {run && stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi title="Employees" value={String(run.lines.length)} detail={run.sourceName} />
            <Kpi title="USD payable" value={money(stats.usd, "USD")} detail="Source currency" />
            <Kpi title="PKR payable" value={money(stats.pkr, "PKR")} detail="Source currency" />
            <Kpi title="USD equivalent" value={money(stats.usdEq, "USD")} detail={`At ${run.fxPkrPerUsd} PKR per USD (source rate)`} />
            <Kpi title="Rows needing review" value={String(stats.review)} detail={`${stats.variances} pay discrepancies`} />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-base-700 bg-base-900 p-3">
            <span className="text-xs text-ink-500">Pay period</span>
            <input type="month" className={input} value={period} disabled={!isDraft} onChange={(e) => setPeriod(e.target.value)} />
            {!period && <span className="text-[11px] text-amber-400">Not supplied in source. Finance must confirm it.</span>}
            <div className="ml-auto flex flex-wrap gap-2">
              <button className={btn} disabled={!!busy} onClick={() => act("download", () => download(`/api/finance/payroll/runs/${run.id}/workbook`, undefined, "Sphaera_People_Costs.xlsx"))}>Download workbook</button>
              {isDraft && (
                <>
                  <button className={btn} disabled={!!busy || !dirtyCount} onClick={saveDraft}>{busy === "save" ? "Saving…" : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}</button>
                  <button className={btn} disabled={!!busy} onClick={remove}>Delete draft</button>
                  <button className={btnPrimary} disabled={!!busy} onClick={approve}>{busy === "approve" ? "Approving…" : "Approve run"}</button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs ${tab === t ? "bg-base-600 text-ink-50" : "bg-base-800 text-ink-500 hover:text-ink-300"}`}>
                {t}
                {t === "Exceptions" ? ` (${run.exceptions.length})` : ""}
              </button>
            ))}
          </div>

          {tab === "People Costs" && (
            <WidgetCard
              title="Payroll master | employee costs"
              action={
                <label className="flex items-center gap-1 text-[11px] text-ink-500">
                  <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} /> Review rows only
                </label>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-base-700 bg-base-900">
                    <tr>
                      {["CSV row", "Employee", "Source dept", "Approved department", "Designation", "Cur", "Base", "Transport", "Bookings", "Deal closed", "Components", "Payable", "Variance", "USD equiv.", "Status", "Source comments", "Review note"].map((h) => <th key={h} className={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {masterMore.visible
                      .map((l) => {
                        const varies = Math.abs(l.variance) > 0.009;
                        const review = varies || !l.approvedDepartment;
                        const setEdit = (patch: { approvedDepartment?: string | null; reviewNote?: string | null }) => setEdits((e) => ({ ...e, [l.id]: { ...e[l.id], ...patch } }));
                        return (
                          <tr key={l.id} className="border-b border-base-800 align-top">
                            <td className={tdNum}>{l.csvRow}</td>
                            <td className={td + " text-ink-50"}>{l.employeeName}</td>
                            <td className={td}>{l.sourceDepartment ?? "—"}</td>
                            <td className={td}>
                              {isDraft ? (
                                <select className={`${input} ${!l.approvedDepartment ? "border-amber-500" : ""}`} value={l.approvedDepartment ?? ""} onChange={(e) => setEdit({ approvedDepartment: e.target.value || null })}>
                                  <option value="">— choose —</option>
                                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                              ) : (
                                l.approvedDepartment
                              )}
                            </td>
                            <td className={td}>{l.designation ?? ""}</td>
                            <td className={td}>{l.currency}</td>
                            <td className={tdNum}>{num(l.baseSalary)}</td>
                            <td className={tdNum}>{num(l.transportAllowance)}</td>
                            <td className={tdNum}>{num(l.bookingsCommission)}</td>
                            <td className={tdNum}>{num(l.dealClosedCommission)}</td>
                            <td className={tdNum}>{num(l.componentSum)}</td>
                            <td className={tdNum + " text-ink-50"}>{num(l.sourcePayable)}</td>
                            <td className={`${tdNum} ${varies ? "text-amber-400" : ""}`}>{num(l.variance)}</td>
                            <td className={tdNum}>{num(l.usdEquivalent)}</td>
                            <td className={td}><span className={review ? "text-amber-400" : "text-emerald-400"}>{review ? "Review" : "OK"}</span></td>
                            <td className="max-w-[260px] whitespace-pre-wrap px-2 py-1.5 text-[11px] text-ink-500">{l.sourceComments}</td>
                            <td className={td}>
                              {isDraft ? (
                                <input className={`${input} w-56 ${varies && !l.reviewNote ? "border-amber-500" : ""}`} placeholder={varies ? "Required: explain the difference" : ""} value={l.reviewNote ?? ""} onChange={(e) => setEdit({ reviewNote: e.target.value })} />
                              ) : (
                                <span className="text-ink-500">{l.reviewNote}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <ShowMoreBar state={masterMore} />
            </WidgetCard>
          )}

          {tab === "Department Summary" && (
            <WidgetCard
              title="Department allocation | payroll"
              action={deptSummary.length > LIST_PAGE ? <ListSearch value={deptSearch.query} onChange={deptSearch.setQuery} placeholder="Filter departments…" /> : undefined}
            >
              <table className="w-full text-xs">
                <thead className="border-b border-base-700"><tr>{["Approved department", "Employees", "USD payable", "PKR payable", "USD equivalent", "Review rows"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {deptMore.visible.map((r) => (
                    <tr key={r.department} className="border-b border-base-800">
                      <td className={td + " text-ink-50"}>{r.department}</td>
                      <td className={tdNum}>{r.employees}</td>
                      <td className={tdNum}>{num(r.usd)}</td>
                      <td className={tdNum}>{num(r.pkr)}</td>
                      <td className={tdNum}>{num(r.usdEq)}</td>
                      <td className={`${tdNum} ${r.review ? "text-amber-400" : ""}`}>{r.review}</td>
                    </tr>
                  ))}
                  {deptSummary.length > 0 && !deptSearch.filtered.length && <tr><td className={td} colSpan={6}>No departments match.</td></tr>}
                </tbody>
              </table>
              <ShowMoreBar state={deptMore} />
            </WidgetCard>
          )}

          {tab === "Exceptions" && (
            <WidgetCard
              title="Finance review queue"
              action={run.exceptions.length > LIST_PAGE ? <ListSearch value={exceptionSearch.query} onChange={exceptionSearch.setQuery} placeholder="Filter employee, issue, evidence…" /> : undefined}
            >
              <p className="mb-2 text-[11px] text-ink-500">Every discrepancy is preserved. A source comment may explain a difference but is not approval. Exceptions reflect the saved draft.</p>
              <table className="w-full text-xs">
                <thead className="border-b border-base-700"><tr>{["CSV row", "Employee / summary", "Issue", "Currency", "Components", "Payable", "Variance", "Evidence"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {exceptionMore.visible.map((e, i) => (
                    <tr key={i} className="border-b border-base-800 align-top">
                      <td className={tdNum}>{e.csvRow ?? ""}</td>
                      <td className={td + " text-ink-50"}>{e.subject}</td>
                      <td className="px-2 py-1.5 text-ink-300">{e.issue}</td>
                      <td className={td}>{e.currency ?? ""}</td>
                      <td className={tdNum}>{num(e.components)}</td>
                      <td className={tdNum}>{num(e.sourcePayable)}</td>
                      <td className={`${tdNum} text-amber-400`}>{num(e.variance)}</td>
                      <td className="max-w-[360px] whitespace-pre-wrap px-2 py-1.5 text-[11px] text-ink-500">{e.evidence}</td>
                    </tr>
                  ))}
                  {run.exceptions.length > 0 && !exceptionSearch.filtered.length && <tr><td className={td} colSpan={8}>No exceptions match.</td></tr>}
                </tbody>
              </table>
              <ShowMoreBar state={exceptionMore} />
            </WidgetCard>
          )}

          {tab === "Source Totals" && (
            <WidgetCard title="Source grand totals (comparison only)">
              <p className="mb-2 text-[11px] text-ink-500">Totals embedded in the source are not employees. Compare only; they never replace the row-level payroll.</p>
              <table className="w-full text-xs">
                <thead className="border-b border-base-700"><tr>{["CSV row", "Label", "Source USD", "Source PKR", "Diff vs rows USD", "Diff vs rows PKR"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {run.sourceTotals.map((t, i) => (
                    <tr key={i} className="border-b border-base-800">
                      <td className={tdNum}>{t.csvRow}</td>
                      <td className={td}>{t.label}</td>
                      <td className={tdNum}>{num(t.usd)}</td>
                      <td className={tdNum}>{num(t.pkr)}</td>
                      <td className={tdNum}>{t.usd === null ? "" : num(t.usd - stats.usd)}</td>
                      <td className={tdNum}>{t.pkr === null ? "" : num(t.pkr - stats.pkr)}</td>
                    </tr>
                  ))}
                  {!run.sourceTotals.length && <tr><td className={td} colSpan={6}>No summary totals found in the source.</td></tr>}
                </tbody>
              </table>
            </WidgetCard>
          )}

          {tab === "Reconciliation" && (
            <WidgetCard
              title="Payroll master vs attributed ledger spend"
              action={reconRows.length > LIST_PAGE ? <ListSearch value={reconSearch.query} onChange={reconSearch.setQuery} placeholder="Filter employee, department, status…" /> : undefined}
            >
              {!run.reconciliation ? (
                <p className="text-xs text-ink-500">Confirm and save the pay period to reconcile against person allocations for that month.</p>
              ) : (
                <>
                  <p className="mb-2 text-[11px] text-ink-500">
                    Master USD equivalent per employee vs person allocations on ledger payments in {run.reconciliation.month} (People Costs tab).
                    Master {money(run.reconciliation.totals.masterUsdEquivalent, "USD")} · attributed {money(run.reconciliation.totals.attributedUsd, "USD")}.
                    {!run.approvedAt && " Employees are linked to People records on approval."}
                  </p>
                  <table className="w-full text-xs">
                    <thead className="border-b border-base-700"><tr>{["Employee", "Department", "Master USD equiv.", "Attributed USD", "Difference", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {reconMore.visible.map((r) => (
                        <tr key={r.key} className="border-b border-base-800">
                          <td className={td + " text-ink-50"}>{r.employeeName}</td>
                          <td className={td}>{r.department ?? "—"}</td>
                          <td className={tdNum}>{r.master === null ? "—" : num(r.master)}</td>
                          <td className={tdNum}>{num(r.attributed)}</td>
                          <td className={tdNum}>{num(r.difference)}</td>
                          <td className={td}>
                            <span className={r.notOnMaster ? "text-red-400" : r.status === "Matched" ? "text-emerald-400" : "text-amber-400"}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                      {reconRows.length > 0 && !reconSearch.filtered.length && <tr><td className={td} colSpan={6}>No employees match.</td></tr>}
                    </tbody>
                  </table>
                  <ShowMoreBar state={reconMore} />
                </>
              )}
            </WidgetCard>
          )}
        </>
      )}
    </div>
  );
}
