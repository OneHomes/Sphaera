"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFinanceFilters } from "./FinanceFilterContext";
import { fyOf } from "@/lib/finance/financeFilters";
import { effectiveCentre } from "@/lib/finance/financeReporting";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";
import { PERSONNEL_COST_HEADS, personCostColumn, personCostHead } from "@/lib/finance/personCostHeads";

// Port of the source app's People Costs screen at v41: employee roster Excel import, suggested
// name/alias payment matches, the cost-per-person report, the employee register (job title,
// email, payment alias), cross-year payment search with multi-select batch allocation to one
// employee, the single-payment split editor and the allocation history. Allocations attribute
// existing ledger payments; they are never additional expenses.

const NEW_CATEGORY = "__new_category__";

type Person = {
  id: string;
  fullName: string;
  department: string | null;
  jobTitle: string;
  email: string;
  paymentAlias: string;
  active: boolean;
};

type Allocation = {
  id: string;
  transactionId: string;
  personId: string;
  costType: string;
  amountUsd: number;
  departmentSnapshot: string | null;
  jobTitleSnapshot: string;
  reference: string | null;
  note: string | null;
  updatedAt: string | Date;
  paymentDescription: string;
  month: string;
  paymentDate: string | Date | null;
  paymentAmount: number;
  personName: string;
};

type Suggestion = {
  transactionId: string;
  personId: string;
  personName: string;
  jobTitle: string;
  department: string | null;
  description: string;
  month: string;
  costType: string;
  amountUsd: number;
  confidence?: "exact" | "partial";
};

type PersonCostState = {
  people: Person[];
  allocations: Allocation[];
  costTypes: string[];
  suggestions: Suggestion[];
};

type RawRosterRow = { row: number; id: string; full_name: string; department: string; job_title: string; email: string; payment_alias: string; active: string };
type CheckedRosterRow = {
  row: number;
  status: string;
  full_name: string;
  department: string;
  job_title: string;
  email: string;
  errors: string[];
  warnings: string[];
  emailConflictRows: number[];
};
type ImportPreview = {
  fileName: string;
  rawRows: RawRosterRow[];
  rows: CheckedRosterRow[];
  valid: number;
  errors: number;
};

type AllocationLineDraft = { key: string; personId: string; costType: string; amountUsd: string; reference: string; note: string };
type Pick = { costType: string; amountUsd: string; reference: string };

// Source peMoney(): exact USD with cents.
const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Payment dates arrive as Date objects (or ISO strings); show them as 2026-09-30.
function isoDate(value: Date | string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function usd(value: number): string {
  return moneyFmt.format(Number(value) || 0);
}
const cents = (n: number | string) => Math.round(Number(n) * 100);

// Source peType() / peIsPersonnel().
// Returns a Simple cost head: the payment's own head when it is already a staff head.
function guessType(t: FinanceLedgerRow): string {
  if (t.managementCostHead && PERSONNEL_COST_HEADS.has(t.managementCostHead)) return t.managementCostHead;
  const s = [effectiveCentre(t), t.head, t.description].join(" ").toLowerCase();
  if (/commission|comm\b|referral/.test(s)) return "Commissions";
  if (/bonus|incentive/.test(s)) return "Bonuses & Incentives";
  if (/employer tax|payroll tax/.test(s)) return "Employer Payroll Taxes";
  if (/benefit|pension/.test(s)) return "Staff Benefits & Pensions";
  return "Salaries";
}
// Same keywords the server uses for suggestions (salary / commission / bonus payments).
const isStaffPayment = (t: FinanceLedgerRow) => /commission|salary|payroll|bonus|incentive/.test(`${t.costCentre ?? ""} ${t.head ?? ""} ${t.description}`.toLowerCase());
// Payments to companies or for payroll fees, not to one person.
const NOT_A_PERSON = /\b(ltd|limited|llc|inc|group|charges?|processing|adp|nest|zelle|fees?|hmrc|pension|payroll|office|stripe|balances?|refund)\b/i;
const NAME_NOISE = new Set(["salary", "salaries", "commission", "commissions", "payment", "to", "on", "a", "c", "ac", "of", "bonus", "for", "the", "month", "ref", "call", "centre", "center", "staff", "external", "agent", "and", "advance", "paid", "pay", "transfer", "monthly"]);
/** Best-effort person name from a bank description, e.g. "Jebby Jose salary (50%)" -> "Jebby Jose". */
function nameFromDescription(description: string): string {
  const words = description
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\s'-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !NAME_NOISE.has(w.toLowerCase()));
  return words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
const isPersonnel = (t: FinanceLedgerRow) =>
  /salary|salaries|payroll|wages|commission|bonus|incentive|pension|benefit|personnel|staff|employer tax|reimburse/.test(
    [effectiveCentre(t), t.head, t.description].join(" ").toLowerCase()
  );

function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function newDraftLine(): AllocationLineDraft {
  return { key: Math.random().toString(36).slice(2), personId: "", costType: "Salaries", amountUsd: "", reference: "", note: "" };
}

const inputClass = "w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500";
const labelClass = "flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500";
const smallBtn = "rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40";
const primaryBtn = "rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:opacity-90 disabled:opacity-50";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export function PeopleCostsPage({
  state,
  departments,
  transactions,
}: {
  state: PersonCostState;
  departments: string[];
  transactions: FinanceLedgerRow[];
}) {
  const [data, setData] = useState<PersonCostState>(state);
  // Fresh server data (Refresh button, Back/Forward) replaces what this screen holds.
  useEffect(() => setData(state), [state]);
  const { people, allocations } = data;
  const { filters } = useFinanceFilters();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/finance/people");
    if (res.ok) setData(await res.json());
  }, []);

  // Simple cost heads: the ledger's full list (same as the payment detail form), plus any added here.
  const [addedTypes, setAddedTypes] = useState<string[]>([]);
  const categoryOptions = useMemo(() => Array.from(new Set<string>([...(data.costTypes ?? []), ...addedTypes])), [data.costTypes, addedTypes]);
  /**
   * Handles a Simple cost head <select>. "+ Add new cost head…" registers the head in Finance
   * (the same list Organise Costs and the payment form use), so it is available everywhere.
   */
  async function chooseCategory(value: string, apply: (costType: string) => void) {
    if (value !== NEW_CATEGORY) return apply(value);
    const name = window.prompt("New Simple cost head (e.g. Performance Bonus). It is added to the Finance cost head list:")?.trim().split(/\s+/).join(" ");
    if (!name) return;
    const existing = categoryOptions.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) return apply(existing);
    try {
      await postJson("/api/finance/cost-heads", { name });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not add the cost head");
      return;
    }
    setAddedTypes((prev) => [...prev, name]);
    apply(name);
  }

  // Change one history line's category in place (amount, employee and snapshots stay the same).
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function changeCategory(allocationId: string, costType: string) {
    const line = allocations.find((a) => a.id === allocationId);
    if (!line || line.costType === costType) return;
    setSavingCategory(allocationId);
    setHistoryMessage(null);
    try {
      const body = await postJson("/api/finance/people/category", { allocationId, costType });
      setData((prev) => ({
        ...prev,
        allocations: prev.allocations.map((a) => (a.id === allocationId ? { ...a, costType: body.costType } : a)),
        costTypes: prev.costTypes.includes(body.costType) ? prev.costTypes : [...prev.costTypes, body.costType],
      }));
      setHistoryMessage({
        kind: "ok",
        text: `${line.personName}: ${personCostHead(line.costType)} → ${body.costType}. The payment shows the same cost head in Spending Explorer. You can undo this in Change History.`,
      });
    } catch (err) {
      setHistoryMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not change the category" });
    } finally {
      setSavingCategory(null);
    }
  }

  const txById = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const usedCents = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocations) m.set(a.transactionId, (m.get(a.transactionId) ?? 0) + cents(a.amountUsd));
    return m;
  }, [allocations]);
  const balance = useCallback((t: FinanceLedgerRow) => (cents(t.amount) - (usedCents.get(t.id) ?? 0)) / 100, [usedCents]);

  // --- Cost per person (respects the global reporting filters) ----------------------------------
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");

  const scopedAllocations = useMemo(
    () =>
      allocations.filter(
        (a) =>
          (filters.fy === "all" || fyOf(a.month) === Number(filters.fy)) &&
          (filters.start === "all" || a.month >= filters.start) &&
          (filters.end === "all" || a.month <= filters.end) &&
          (filters.country === "all" || txById.get(a.transactionId)?.country === filters.country) &&
          (filters.department === "all" || a.departmentSnapshot === filters.department)
      ),
    [allocations, filters, txById]
  );
  const filteredAllocations = useMemo(
    () =>
      scopedAllocations.filter(
        (a) => (filterDept === "all" || (a.departmentSnapshot ?? "") === filterDept) && (filterPerson === "all" || a.personId === filterPerson)
      ),
    [scopedAllocations, filterDept, filterPerson]
  );

  const sumBy = (pred: (a: Allocation) => boolean) => filteredAllocations.filter(pred).reduce((s, a) => s + a.amountUsd, 0);
  const attributedSalary = sumBy((a) => personCostColumn(a.costType) === "salary");
  const attributedCommission = sumBy((a) => personCostColumn(a.costType) === "commission");
  const otherEmployerCosts = sumBy((a) => personCostColumn(a.costType) === "other");

  const costPerPerson = useMemo(() => {
    const map = new Map<string, { personId: string; name: string; department: string | null; jobTitle: string; salary: number; commission: number; other: number; total: number }>();
    for (const a of filteredAllocations) {
      const e = map.get(a.personId) ?? { personId: a.personId, name: a.personName, department: a.departmentSnapshot, jobTitle: a.jobTitleSnapshot, salary: 0, commission: 0, other: 0, total: 0 };
      const column = personCostColumn(a.costType);
      if (column === "salary") e.salary += a.amountUsd;
      else if (column === "commission") e.commission += a.amountUsd;
      else e.other += a.amountUsd;
      e.total += a.amountUsd;
      map.set(a.personId, e);
    }
    const linked = Array.from(map.values()).sort((a, b) => b.total - a.total);
    // Everyone in the chosen department appears, even with nothing linked yet ($0), so the gaps are visible.
    if (filterPerson !== "all") return linked;
    const dept = filterDept !== "all" ? filterDept : filters.department !== "all" ? filters.department : null;
    const zero = people
      .filter((p) => p.active && !map.has(p.id) && (!dept || p.department === dept))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((p) => ({ personId: p.id, name: p.fullName, department: p.department, jobTitle: p.jobTitle, salary: 0, commission: 0, other: 0, total: 0 }));
    return [...linked, ...zero];
  }, [filteredAllocations, filterPerson, filterDept, filters.department, people]);
  const costTotals = useMemo(
    () =>
      costPerPerson.reduce(
        (s, r) => ({ salary: s.salary + r.salary, commission: s.commission + r.commission, other: s.other + r.other, total: s.total + r.total, unlinked: s.unlinked + (r.total === 0 ? 1 : 0) }),
        { salary: 0, commission: 0, other: 0, total: 0, unlinked: 0 }
      ),
    [costPerPerson]
  );
  const historyRef = useRef<HTMLDivElement | null>(null);
  const showPersonPayments = (personId: string) => {
    setFilterPerson(personId);
    setTimeout(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // --- Excel roster import ----------------------------------------------------------------------
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label);
    setNotice(null);
    try {
      const text = await fn();
      if (text) setNotice({ kind: "ok", text });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  // Linked payments whose ledger department doesn't match their employee yet (re-checked after every change).
  const [ledgerSync, setLedgerSync] = useState<{ count: number; byDepartment: Record<string, number> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance/people/ledger-sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => !cancelled && setLedgerSync(body))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data]);
  const syncLedger = () =>
    run("ledger", async () => {
      if (!ledgerSync?.count) return;
      if (!window.confirm(`Move ${ledgerSync.count} linked payments to their employee's department in Spending Explorer? This is one change you can undo in Change History.`)) return;
      const body = await postJson("/api/finance/people/ledger-sync", {});
      await reload();
      return `Moved ${body.moved} payments to their employee's department. Spending Explorer now shows them there.`;
    });

  const previewExcel = (file: File) =>
    run("preview", async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/finance/people/preview", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Preview failed");
      setPreview({ fileName: file.name, ...body });
      setShowAllRows(!body.errors);
    });

  // Corrections made on the preview screen: edit the raw row, then re-check every row on the
  // server (rules like duplicate emails span rows). The latest request wins.
  const [showAllRows, setShowAllRows] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const checkSeq = useRef(0);
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function editRows(update: (rows: RawRosterRow[]) => RawRosterRow[]) {
    if (!preview) return;
    const rawRows = update(preview.rawRows);
    setPreview({ ...preview, rawRows });
    setRechecking(true);
    if (recheckTimer.current) clearTimeout(recheckTimer.current);
    recheckTimer.current = setTimeout(async () => {
      const seq = ++checkSeq.current;
      try {
        const res = await fetch("/api/finance/people/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rawRows }),
        });
        const body = await res.json().catch(() => null);
        if (seq !== checkSeq.current) return;
        if (!res.ok) throw new Error(body?.error ?? "Check failed");
        setPreview((prev) => (prev ? { ...prev, rows: body.rows, valid: body.valid, errors: body.errors } : prev));
      } catch (err) {
        if (seq === checkSeq.current) setNotice({ kind: "error", text: err instanceof Error ? err.message : "Check failed" });
      } finally {
        if (seq === checkSeq.current) setRechecking(false);
      }
    }, 350);
  }
  const editRow = (rowNo: number, patch: Partial<RawRosterRow>) =>
    editRows((rows) => rows.map((r) => (r.row === rowNo ? { ...r, ...patch } : r)));
  // "Email belongs here": keep it on this row, blank it on the other rows that used it.
  const keepEmailOn = (rowNo: number, others: number[]) =>
    editRows((rows) => rows.map((r) => (others.includes(r.row) ? { ...r, email: "" } : r)));

  // A ref (not state) so a fast double-click can't send the import twice before React re-renders.
  const importing = useRef(false);
  const commitExcel = () => {
    if (importing.current) return;
    return run("commit", async () => {
      if (!preview || preview.errors || rechecking) throw new Error("Fix the highlighted rows before import.");
      if (!window.confirm(`Import ${preview.rows.length} employee records? No payment amounts will be changed.`)) return;
      importing.current = true;
      try {
        const res = await fetch("/api/finance/people/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: preview.rawRows, fileName: preview.fileName }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Import failed");
        setPreview(null);
        await reload();
        return `People directory: ${body.added} added, ${body.updated} updated, ${body.unchanged} unchanged. Review suggested payment matches below.`;
      } finally {
        importing.current = false;
      }
    });
  };

  // --- Suggested matches ------------------------------------------------------------------------
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const suggestions = data.suggestions ?? [];
  const partialCount = suggestions.filter((s) => s.confidence === "partial").length;
  // The server links at most 300 payments per click.
  const LINK_LIMIT = 300;
  const selectSuggestions = (includePartial: boolean) =>
    setSelectedMatches(
      new Set(
        suggestions
          .filter((s) => includePartial || s.confidence !== "partial")
          .slice(0, LINK_LIMIT)
          .map((s) => s.transactionId)
      )
    );
  // Staff payments nobody is linked to and no suggestion covers, grouped by the name on the payment.
  const unknownPayees = useMemo(() => {
    const suggested = new Set(suggestions.map((s) => s.transactionId));
    const groups = new Map<string, { name: string; count: number; total: number; latest: string }>();
    let companyCount = 0;
    let companyTotal = 0;
    for (const t of transactions) {
      if (!(Number(t.amount) > 0) || !isStaffPayment(t) || suggested.has(t.id) || balance(t) <= 0.009) continue;
      if (NOT_A_PERSON.test(t.description)) {
        companyCount += 1;
        companyTotal += balance(t);
        continue;
      }
      const name = nameFromDescription(t.description);
      if (!name) continue;
      const key = name.toLowerCase();
      const g = groups.get(key) ?? { name, count: 0, total: 0, latest: "" };
      g.count += 1;
      g.total += balance(t);
      if (t.month > g.latest) g.latest = t.month;
      groups.set(key, g);
    }
    return { rows: Array.from(groups.values()).sort((a, b) => b.total - a.total), companyCount, companyTotal };
  }, [transactions, suggestions, balance]);
  const [showAllUnknown, setShowAllUnknown] = useState(false);

  // Add an unknown payee as a new employee, or attach the bank name to an existing employee as a
  // payment alias. Either way their payments then show up in the suggestions for review.
  const [payeeForm, setPayeeForm] = useState<
    { bankName: string; mode: "add" | "link"; fullName: string; department: string; jobTitle: string; active: boolean; personId: string } | null
  >(null);
  const [payeeMessage, setPayeeMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  function openPayeeForm(bankName: string, mode: "add" | "link") {
    setPayeeMessage(null);
    setPayeeForm({ bankName, mode, fullName: bankName, department: filterDept !== "all" ? filterDept : "", jobTitle: "", active: true, personId: "" });
  }
  const savePayee = () =>
    run("payee", async () => {
      if (!payeeForm) return;
      setPayeeMessage(null);
      const f = payeeForm;
      let personId: string;
      let personName: string;
      try {
        if (f.mode === "add") {
          const name = f.fullName.trim();
          const body = await postJson("/api/finance/people", {
            name,
            department: f.department,
            jobTitle: f.jobTitle,
            active: f.active,
            // Keep the bank spelling as an alias when the employee name is written differently.
            paymentAlias: name.toLowerCase() === f.bankName.toLowerCase() ? "" : f.bankName,
          });
          personId = body.id;
          personName = name;
        } else {
          const p = people.find((x) => x.id === f.personId);
          if (!p) throw new Error("Choose the employee these payments belong to.");
          const aliases = p.paymentAlias.split(";").map((a) => a.trim()).filter(Boolean);
          if (!aliases.some((a) => a.toLowerCase() === f.bankName.toLowerCase())) aliases.push(f.bankName);
          await postJson("/api/finance/people", {
            id: p.id,
            name: p.fullName,
            department: p.department ?? "",
            jobTitle: p.jobTitle,
            email: p.email,
            paymentAlias: aliases.join("; "),
            active: p.active,
          });
          personId = p.id;
          personName = p.fullName;
        }
      } catch (err) {
        setPayeeMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
        throw err;
      }
      setPayeeForm(null);
      const res = await fetch("/api/finance/people");
      const next: PersonCostState | null = res.ok ? await res.json() : null;
      if (next) setData(next);
      const found = next ? next.suggestions.filter((s) => s.personId === personId).length : 0;
      const text = found
        ? `${f.mode === "add" ? `Added ${personName}` : `Linked “${f.bankName}” to ${personName}`}. ${found} of their payments are now in “Suggested salary and commission matches” above: review them and click Link.`
        : `${f.mode === "add" ? `Added ${personName}` : `Linked “${f.bankName}” to ${personName}`}, but no payment matched automatically. Use Find payments to assign them by hand.`;
      setPayeeMessage({ kind: "ok", text });
      return text;
    });
  const searchPayments = (text: string) => {
    setQueryInput(text);
    setQuery(text);
    setTimeout(() => findRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const linkMatches = () =>
    run("link", async () => {
      const ids = [...selectedMatches];
      if (!ids.length) throw new Error("Select proposed matches first.");
      const total = suggestions.filter((s) => selectedMatches.has(s.transactionId)).reduce((n, s) => n + s.amountUsd, 0);
      if (!window.confirm(`Assign ${ids.length} existing payments to the suggested employees? Total: ${usd(total)}\n\nReview the individual employee names first.`)) return;
      const body = await postJson("/api/finance/people/link-suggestions", { transactionIds: ids }).catch(async (err) => {
        // A timeout can still have saved on the server: reload so the screen shows what really happened.
        setSelectedMatches(new Set());
        await reload();
        throw new Error(`${err instanceof Error ? err.message : "Request failed"}. The page was refreshed; check the history below before trying again.`);
      });
      setSelectedMatches(new Set());
      await reload();
      return `${body.linked} payments linked; ${usd(body.totalUsd)} attributed. Original ledger unchanged.`;
    });

  // --- Find payments + batch allocation (v41) ---------------------------------------------------
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [scope, setScope] = useState<"personnel" | "all">("personnel");
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  // Source pePaymentChoices(): every year, independent of the dashboard filters.
  const choices = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return transactions
      .filter((t) => {
        if (!(Number(t.amount) > 0)) return false;
        if (!terms.length && scope === "personnel" && !isPersonnel(t)) return false;
        const hay = [t.id, t.description, t.head, t.costCentre, t.month, t.date ? isoDate(t.date) : "", t.paymentReference, t.erpPaymentId, t.invoiceReference, t.traceSupplier, t.tracePurpose, t.country, Number(t.amount).toFixed(2)]
          .join(" ")
          .toLowerCase();
        if (!terms.every((term) => hay.includes(term))) return false;
        return !onlyUnassigned || balance(t) > 0.009;
      })
      .sort((a, b) => String(b.date ?? b.month).localeCompare(String(a.date ?? a.month)) || String(b.id).localeCompare(String(a.id)));
  }, [transactions, query, scope, onlyUnassigned, balance]);
  const displayed = choices.slice(0, 80);
  const pickEntries = Object.entries(picks);
  const pickTotal = pickEntries.reduce((n, [, p]) => n + (Number(p.amountUsd) || 0), 0);

  function addPick(t: FinanceLedgerRow, into: Record<string, Pick>) {
    if (balance(t) <= 0 || into[t.id]) return;
    into[t.id] = { costType: guessType(t), amountUsd: balance(t).toFixed(2), reference: "" };
  }
  function togglePick(t: FinanceLedgerRow, on: boolean) {
    setPicks((prev) => {
      const next = { ...prev };
      if (on) addPick(t, next);
      else delete next[t.id];
      return next;
    });
  }
  // Ticks are kept when the employee is chosen (or changed) after selecting payments.
  const findRef = useRef<HTMLDivElement | null>(null);
  function chooseEmployee(id: string, scroll = false) {
    setSelectedEmployee(id);
    if (scroll) setTimeout(() => findRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // --- Edit one employee (name, department, job title, payment alias) --------------------------
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const employeesRef = useRef<HTMLDivElement | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);
  function startEditPerson(p: Person) {
    setPersonError(null);
    setEditPerson({ ...p });
  }
  const savePersonEdit = () =>
    run("person", async () => {
      if (!editPerson) return;
      setPersonError(null);
      const before = people.find((p) => p.id === editPerson.id);
      await postJson("/api/finance/people", {
        id: editPerson.id,
        name: editPerson.fullName,
        department: editPerson.department ?? "",
        jobTitle: editPerson.jobTitle,
        email: editPerson.email,
        paymentAlias: editPerson.paymentAlias,
        active: editPerson.active,
      }).catch((err) => {
        setPersonError(err instanceof Error ? err.message : "Save failed");
        throw err;
      });
      setEditPerson(null);
      await reload();
      return before && before.fullName !== editPerson.fullName.trim()
        ? `Renamed ${before.fullName} to ${editPerson.fullName.trim()}.`
        : `Saved ${editPerson.fullName.trim()}.`;
    });

  const saveBatch = () =>
    run("batch", async () => {
      if (!selectedEmployee || !pickEntries.length) throw new Error("Select an employee and at least one payment.");
      for (const [id, p] of pickEntries) {
        const t = txById.get(id);
        if (!t || !(Number(p.amountUsd) > 0) || cents(p.amountUsd) > cents(balance(t))) throw new Error("A selected payment amount exceeds its unallocated balance.");
      }
      const employee = people.find((p) => p.id === selectedEmployee)?.fullName ?? "employee";
      if (!window.confirm(`Allocate ${pickEntries.length} payments totalling ${usd(pickTotal)} to ${employee}? Categories and amounts will be logged as a single undoable action.`)) return;
      const body = await postJson("/api/finance/people/allocate-batch", {
        personId: selectedEmployee,
        items: pickEntries.map(([transactionId, p]) => ({ transactionId, ...p })),
      }).catch(async (err) => {
        await reload();
        throw new Error(`${err instanceof Error ? err.message : "Request failed"}. The page was refreshed; check the history below before trying again.`);
      });
      setPicks({});
      await reload();
      return `Allocated ${body.payments} payments (${usd(body.allocatedUsd)}).`;
    });

  // --- Single-payment split editor --------------------------------------------------------------
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<AllocationLineDraft[]>([]);
  const [allocError, setAllocError] = useState<string | null>(null);
  const editPayment = editPaymentId ? txById.get(editPaymentId) ?? null : null;
  const hasExisting = editPaymentId ? allocations.some((a) => a.transactionId === editPaymentId) : false;

  function openPayment(id: string) {
    setEditPaymentId(id);
    setAllocError(null);
    const existing = allocations.filter((a) => a.transactionId === id);
    setDraftLines(
      existing.length
        ? existing.map((a) => ({ key: a.id, personId: a.personId, costType: personCostHead(a.costType), amountUsd: a.amountUsd.toFixed(2), reference: a.reference ?? "", note: a.note ?? "" }))
        : [newDraftLine()]
    );
  }
  const updateLine = (key: string, patch: Partial<AllocationLineDraft>) => setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const draftTotal = draftLines.reduce((s, l) => s + (parseFloat(l.amountUsd) || 0), 0);

  async function saveAllocation(clear = false) {
    if (!editPaymentId || busy) return;
    const lines = (clear ? [] : draftLines)
      .filter((l) => l.personId && l.amountUsd)
      .map(({ personId, costType, amountUsd, reference, note }) => ({ personId, costType, amountUsd, reference, note }));
    if (!window.confirm(`Save ${lines.length} allocation line(s) against this original payment?`)) return;
    setBusy("alloc");
    setAllocError(null);
    try {
      const body = await postJson("/api/finance/people/payment", { transactionId: editPaymentId, lines });
      setEditPaymentId(null);
      setDraftLines([]);
      await reload();
      if (Math.abs(body.unallocatedUsd) > 0.009) setNotice({ kind: "ok", text: `${usd(body.unallocatedUsd)} of this payment remains unattributed.` });
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const history = useMemo(
    () => [...filteredAllocations].sort((a, b) => new Date(b.paymentDate ?? 0).getTime() - new Date(a.paymentDate ?? 0).getTime()).slice(0, 200),
    [filteredAllocations]
  );
  const selectedName = people.find((p) => p.id === selectedEmployee)?.fullName;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">People costs · salary and commissions</h2>
        <p className="mt-1 text-sm text-ink-500">
          Assign multiple payroll or commission payments to one employee, or split a payment between people. This attributes existing
          ledger costs without creating new expense transactions. Values shown in USD.
        </p>
      </div>

      {notice && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${notice.kind === "ok" ? "border-status-active/40 bg-status-active/10 text-status-active" : "border-status-inactive/40 bg-status-inactive/10 text-status-inactive"}`}>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Attributed salary" value={usd(attributedSalary)} detail="Within current financial filters" />
        <Kpi title="Attributed commission" value={usd(attributedCommission)} detail="Linked to individual employees" />
        <Kpi title="Other employer costs" value={usd(otherEmployerCosts)} detail="Bonuses, taxes and benefits" />
        <Kpi title="Total attributed people cost" value={usd(attributedSalary + attributedCommission + otherEmployerCosts)} detail="All assigned personnel payment lines" />
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Import employees and departments from Excel"
          action={
            <div className="flex items-center gap-2">
              <a href="/api/finance/people/template" className={smallBtn}>
                Download Excel template
              </a>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-status-active px-3 py-1.5 text-xs font-semibold text-base-950 hover:brightness-110">
                <Upload className="h-3.5 w-3.5" />
                {busy === "preview" ? "Checking…" : "Upload employee Excel"}
                <input type="file" accept=".xlsx" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) previewExcel(f); }} />
              </label>
            </div>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            Download the template (it lists every current employee), add new rows or edit existing ones, then click{" "}
            <b className="text-ink-300">Upload employee Excel</b>. You will see a preview and can fix any row here before importing; no
            bank payments are altered.
          </p>
          {preview && (() => {
            const autoFixed = preview.rows.filter((r) => r.warnings.length && !r.errors.length).length;
            const shown = showAllRows ? preview.rows : preview.rows.filter((r) => r.errors.length || r.warnings.length);
            const rawByRow = new Map(preview.rawRows.map((r) => [r.row, r]));
            const cellInput = `${inputClass} min-w-[130px]`;
            return (
            <div className="mt-3">
              <p className={`mb-2 rounded-lg border px-3 py-2 text-xs ${preview.errors ? "border-status-alert/40 bg-status-alert/10 text-status-alert" : "border-base-700 bg-base-800 text-ink-300"}`}>
                <b>{preview.valid} ready</b> · {preview.errors} need your input · {autoFixed} fixed automatically · {preview.rows.length} total employees.{" "}
                {rechecking ? "Checking…" : preview.errors ? "Fix the highlighted rows here; no need to upload again." : "Everything is ready. Review then confirm."}
              </p>
              <div className="mb-2 flex gap-1.5">
                <button onClick={() => setShowAllRows(false)} className={`${smallBtn} ${!showAllRows ? "border-base-600 text-ink-50" : ""}`}>
                  Needs attention ({preview.rows.filter((r) => r.errors.length || r.warnings.length).length})
                </button>
                <button onClick={() => setShowAllRows(true)} className={`${smallBtn} ${showAllRows ? "border-base-600 text-ink-50" : ""}`}>
                  All rows ({preview.rows.length})
                </button>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>{["Row", "Status", "Name", "Department", "Job title", "Email", "Check"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-500">Nothing needs attention. Switch to All rows to review everything.</td></tr>
                    )}
                    {shown.slice(0, 500).map((r) => {
                      const raw = rawByRow.get(r.row);
                      const fix = r.errors.length > 0 && raw;
                      return (
                        <tr key={r.row} className={`border-b border-base-800 align-top text-ink-300 last:border-0 ${r.errors.length ? "bg-status-inactive/5" : r.warnings.length ? "bg-status-alert/5" : ""}`}>
                          <td className="px-3 py-1.5">{r.row}</td>
                          <td className={`px-3 py-1.5 ${r.errors.length ? "text-status-inactive" : r.warnings.length ? "text-status-alert" : ""}`}>
                            {r.errors.length ? "Fix" : r.warnings.length ? `${r.status} · auto-fixed` : r.status}
                          </td>
                          <td className="px-3 py-1.5 text-ink-50">
                            {fix ? <input value={raw.full_name} onChange={(e) => editRow(r.row, { full_name: e.target.value })} className={cellInput} /> : r.full_name}
                          </td>
                          <td className="px-3 py-1.5">
                            {fix ? (
                              <select value={departments.includes(r.department) ? r.department : ""} onChange={(e) => editRow(r.row, { department: e.target.value })} className={cellInput}>
                                <option value="">Choose department…</option>
                                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                            ) : (
                              r.department
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {fix ? <input value={raw.job_title} onChange={(e) => editRow(r.row, { job_title: e.target.value })} placeholder="Job title" className={cellInput} /> : r.job_title}
                          </td>
                          <td className="px-3 py-1.5">
                            {fix ? (
                              <div className="space-y-1">
                                <input value={raw.email} onChange={(e) => editRow(r.row, { email: e.target.value })} placeholder="Optional" className={cellInput} />
                                {r.emailConflictRows.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    <button onClick={() => keepEmailOn(r.row, r.emailConflictRows)} className={smallBtn}>Email belongs here</button>
                                    <button onClick={() => editRow(r.row, { email: "" })} className={smallBtn}>Remove from this row</button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              r.email
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {r.errors.map((e) => <div key={e} className="text-status-inactive">{e}</div>)}
                            {r.warnings.map((w) => <div key={w} className="text-status-alert">Auto-fixed: {w}</div>)}
                            {!r.errors.length && !r.warnings.length && <span className="text-status-active">Ready</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={commitExcel} disabled={!!busy || rechecking || preview.errors > 0} className={primaryBtn}>
                  {busy === "commit"
                    ? "Importing…"
                    : preview.errors
                      ? `Fix ${preview.errors} row${preview.errors === 1 ? "" : "s"} to import`
                      : `Confirm & import ${preview.rows.length} employees`}
                </button>
                <button onClick={() => setPreview(null)} className={smallBtn}>
                  Cancel
                </button>
              </div>
            </div>
            );
          })()}
        </WidgetCard>
      </div>

      {ledgerSync && ledgerSync.count > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-alert/40 bg-status-alert/10 px-4 py-3 text-xs text-ink-300">
          <span>
            <b className="text-ink-50">{ledgerSync.count} linked payments</b> are still under another department in Spending Explorer (
            {Object.entries(ledgerSync.byDepartment)
              .sort((a, b) => b[1] - a[1])
              .map(([d, n]) => `${d} ${n}`)
              .join(", ")}
            ). Move them to their employee&apos;s department? New links are moved automatically.
          </span>
          <button onClick={syncLedger} disabled={!!busy} className={primaryBtn}>
            {busy === "ledger" ? "Moving…" : `Move ${ledgerSync.count} payments`}
          </button>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard title="Suggested salary and commission matches" action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{suggestions.length} candidates</span>}>
          <p className="mb-3 text-xs text-ink-500">
            Based on a unique name or payment alias found in a salary/commission payment description. Review before applying; grouped
            payroll can be split manually below.
          </p>
          {suggestions.length ? (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <button onClick={() => selectSuggestions(false)} className={smallBtn}>
                  Select exact matches ({Math.min(suggestions.length - partialCount, LINK_LIMIT)})
                </button>
                {partialCount > 0 && (
                  <button onClick={() => selectSuggestions(true)} className={smallBtn}>
                    Select all incl. “Check” ({Math.min(suggestions.length, LINK_LIMIT)})
                  </button>
                )}
                <button onClick={() => setSelectedMatches(new Set())} className={smallBtn}>
                  Clear
                </button>
                <button onClick={linkMatches} disabled={!!busy || !selectedMatches.size} className={primaryBtn}>
                  {busy === "link" ? "Linking…" : `Link ${selectedMatches.size} reviewed payments`}
                </button>
              </div>
              <div className="max-h-[320px] overflow-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>{["Select", "Payment", "Suggested person", "Job title", "Department", "Type", "Amount (USD)"].map((h) => <th key={h} className={`px-3 py-2 ${h.startsWith("Amount") ? "text-right" : ""}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => (
                      <tr key={s.transactionId} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedMatches.has(s.transactionId)}
                            onChange={(e) =>
                              setSelectedMatches((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(s.transactionId);
                                else next.delete(s.transactionId);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="max-w-[320px] px-3 py-1.5">
                          <p className="truncate font-medium text-ink-50" title={s.description}>{s.description}</p>
                          <p className="text-[10px] text-ink-500">{s.month} · {s.transactionId}</p>
                        </td>
                        <td className="px-3 py-1.5">
                          {s.personName}
                          {s.confidence === "partial" && (
                            <span
                              title="Name found with a different spelling or middle name (e.g. Mohammad / Muhammad). Check it is the same person before linking."
                              className="ml-1.5 rounded-full bg-status-alert/15 px-1.5 py-0.5 text-[10px] text-status-alert"
                            >
                              Check
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{s.jobTitle}</td>
                        <td className="px-3 py-1.5">{s.department ?? "—"}</td>
                        <td className="px-3 py-1.5">{s.costType}</td>
                        <td className="px-3 py-1.5 text-right">{usd(s.amountUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-500">No unique unassigned payroll matches. Import employees, then refresh this page. Payments with unclear matches should be assigned manually.</p>
          )}
        </WidgetCard>
      </div>

      {unknownPayees.rows.length > 0 && (
        <div className="mt-4">
          <WidgetCard
            title="Paid but not in the employee list"
            action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{unknownPayees.rows.length} names</span>}
          >
            <p className="mb-3 text-xs text-ink-500">
              These names received salary or commission but don&apos;t match anyone in the employee list (they may have left, or their name is
              written differently on the bank). Use <b className="text-ink-300">Add as employee</b> for a new person, or{" "}
              <b className="text-ink-300">Link to existing</b> when the bank name belongs to someone already in the list (it is saved as their
              payment alias). Their payments then appear in the suggestions above for review. You can also assign them by hand with{" "}
              <b className="text-ink-300">Find payments</b>.
            </p>
            {payeeMessage && (
              <p className={`mb-3 rounded-lg border px-3 py-2 text-xs ${payeeMessage.kind === "ok" ? "border-status-active/40 bg-status-active/10 text-status-active" : "border-status-inactive/40 bg-status-inactive/10 text-status-inactive"}`}>
                {payeeMessage.text}
              </p>
            )}
            <div className="max-h-[320px] overflow-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Name on the payment</th>
                    <th className="px-3 py-2 text-right">Payments</th>
                    <th className="px-3 py-2">Latest month</th>
                    <th className="px-3 py-2 text-right">Not linked (USD)</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(showAllUnknown ? unknownPayees.rows : unknownPayees.rows.slice(0, 25)).map((g) => (
                    <Fragment key={g.name}>
                    <tr className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-1.5 font-medium text-ink-50">{g.name}</td>
                      <td className="px-3 py-1.5 text-right">{g.count}</td>
                      <td className="px-3 py-1.5">{g.latest}</td>
                      <td className="px-3 py-1.5 text-right">{usd(g.total)}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex justify-end gap-1.5">
                          <button onClick={() => searchPayments(g.name)} className={smallBtn}>
                            Find payments
                          </button>
                          <button onClick={() => openPayeeForm(g.name, "add")} className={smallBtn}>
                            Add as employee
                          </button>
                          <button onClick={() => openPayeeForm(g.name, "link")} className={smallBtn}>
                            Link to existing
                          </button>
                        </span>
                      </td>
                    </tr>
                    {payeeForm?.bankName === g.name && (
                      <tr className="border-b border-base-800 bg-base-800">
                        <td colSpan={5} className="px-3 py-3">
                          {payeeForm.mode === "add" ? (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                              <label className={labelClass}>
                                Employee full name
                                <input autoFocus value={payeeForm.fullName} onChange={(e) => setPayeeForm({ ...payeeForm, fullName: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                              </label>
                              <label className={labelClass}>
                                Department
                                <select value={payeeForm.department} onChange={(e) => setPayeeForm({ ...payeeForm, department: e.target.value })} className={`${inputClass} normal-case tracking-normal`}>
                                  <option value="">Choose…</option>
                                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </label>
                              <label className={labelClass}>
                                Job title
                                <input value={payeeForm.jobTitle} onChange={(e) => setPayeeForm({ ...payeeForm, jobTitle: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                              </label>
                              <label className={labelClass}>
                                Status
                                <select value={payeeForm.active ? "active" : "inactive"} onChange={(e) => setPayeeForm({ ...payeeForm, active: e.target.value === "active" })} className={`${inputClass} normal-case tracking-normal`}>
                                  <option value="active">Active (still working)</option>
                                  <option value="inactive">Inactive (has left)</option>
                                </select>
                              </label>
                            </div>
                          ) : (
                            <label className={`${labelClass} max-w-md`}>
                              Which employee is “{g.name}”?
                              <select autoFocus value={payeeForm.personId} onChange={(e) => setPayeeForm({ ...payeeForm, personId: e.target.value })} className={`${inputClass} normal-case tracking-normal`}>
                                <option value="">Choose employee…</option>
                                {people.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.department ?? "—"})</option>)}
                              </select>
                            </label>
                          )}
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <span className="mr-auto text-[11px] text-ink-500">
                              {payeeForm.mode === "add"
                                ? "Creates the employee; the bank name is kept as their payment alias if it is spelled differently."
                                : `“${g.name}” is added to this employee's payment alias. Nothing is linked until you review the suggestions.`}
                            </span>
                            <button onClick={() => setPayeeForm(null)} disabled={busy === "payee"} className={smallBtn}>Cancel</button>
                            <button
                              onClick={savePayee}
                              disabled={
                                busy === "payee" ||
                                (payeeForm.mode === "add"
                                  ? payeeForm.fullName.trim().length < 2 || !payeeForm.department || !payeeForm.jobTitle.trim()
                                  : !payeeForm.personId)
                              }
                              className={primaryBtn}
                            >
                              {busy === "payee" ? "Saving…" : payeeForm.mode === "add" ? "Add employee" : "Link"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
              {unknownPayees.rows.length > 25 && (
                <button onClick={() => setShowAllUnknown((v) => !v)} className={smallBtn}>
                  {showAllUnknown ? "Show top 25" : `Show all ${unknownPayees.rows.length}`}
                </button>
              )}
              {unknownPayees.companyCount > 0 && (
                <span>
                  {unknownPayees.companyCount} more payments ({usd(unknownPayees.companyTotal)}) are company, office-wide payroll or fee payments (e.g.
                  Ltd, ADP, &quot;Payroll Aug&quot;) and are not one person&apos;s cost; split those by hand with Split / edit if needed.
                </span>
              )}
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard title="Cost per person">
          <p className="mb-3 text-xs text-ink-500">
            Payment-level department snapshots are preserved when employees move departments. Later transfers do not rewrite historical months.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Department
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Person
              <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All people</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </label>
            {filterPerson !== "all" && (
              <button onClick={() => setFilterPerson("all")} className={smallBtn}>
                Show everyone
              </button>
            )}
            <span className="text-[11px] text-ink-500">Click a person to see their linked payments.</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Job title</th>
                  <th className="px-3 py-2 text-right">Salary</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right" title="Every Simple cost head other than Salaries and Commissions">Bonus &amp; other costs</th>
                  <th className="px-3 py-2 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody>
                {costPerPerson.map((row) => (
                  <tr
                    key={row.personId}
                    onClick={() => {
                      if (row.total) return showPersonPayments(row.personId);
                      // Nothing linked yet: pick them as the receiving employee and search their name.
                      setQueryInput(row.name);
                      setQuery(row.name);
                      chooseEmployee(row.personId, true);
                    }}
                    title={row.total ? "Show this person's linked payments" : "Nothing linked yet: choose this person in “Find payroll and commission payments”"}
                    className={`cursor-pointer border-b border-base-800 last:border-0 hover:bg-base-800 ${row.total ? "text-ink-300" : "text-ink-500"}`}
                  >
                    <td className="px-3 py-2 font-medium text-ink-50">
                      {row.name}
                      {!row.total && <span className="ml-1.5 rounded-full bg-base-800 px-1.5 py-0.5 text-[10px] font-normal text-ink-500">nothing linked</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const person = people.find((p) => p.id === row.personId);
                          if (!person) return;
                          startEditPerson(person);
                          setTimeout(() => employeesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                        }}
                        title="Edit name, department or job title"
                        className="ml-2 text-[10px] font-normal text-ink-500 underline-offset-2 hover:text-ink-50 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                    <td className="px-3 py-2">{row.department ?? "—"}</td>
                    <td className="px-3 py-2">{row.jobTitle || "—"}</td>
                    <td className="px-3 py-2 text-right">{usd(row.salary)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.commission)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.other)}</td>
                    <td className="px-3 py-2 text-right font-medium text-ink-50">{usd(row.total)}</td>
                  </tr>
                ))}
                {costPerPerson.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-ink-500">No staff payment allocations recorded for the selected period.</td>
                  </tr>
                )}
                {costPerPerson.length > 1 && (
                  <tr className="border-t border-base-700 bg-base-900 font-semibold text-ink-50">
                    <td className="px-3 py-2" colSpan={3}>
                      Total · {costPerPerson.length} people
                      {costTotals.unlinked > 0 && <span className="ml-1 font-normal text-ink-500">({costTotals.unlinked} with nothing linked)</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{usd(costTotals.salary)}</td>
                    <td className="px-3 py-2 text-right">{usd(costTotals.commission)}</td>
                    <td className="px-3 py-2 text-right">{usd(costTotals.other)}</td>
                    <td className="px-3 py-2 text-right">{usd(costTotals.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div ref={employeesRef} className="scroll-mt-4">
        <WidgetCard title={`Employees (${people.length})`}>
          <p className="mb-3 text-xs text-ink-500">
            Employees are added through the Excel import above. Click Edit to correct a name, department, job title or payment alias; linked
            payments stay with the person.
          </p>
          <div className="flex max-h-[520px] flex-col gap-1 overflow-y-auto">
            {people.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-500">No employees yet. Upload the employee Excel to add them.</p>}
            {people.map((p) =>
              editPerson?.id === p.id ? (
                <div key={p.id} className="rounded-lg border border-base-600 bg-base-800 p-3 text-xs">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={labelClass}>
                      Full name
                      <input
                        autoFocus
                        value={editPerson.fullName}
                        onChange={(e) => setEditPerson({ ...editPerson, fullName: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePersonEdit();
                          if (e.key === "Escape") setEditPerson(null);
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Department
                      <select value={editPerson.department ?? ""} onChange={(e) => setEditPerson({ ...editPerson, department: e.target.value })} className={inputClass}>
                        {!departments.includes(editPerson.department ?? "") && <option value={editPerson.department ?? ""}>{editPerson.department || "Choose…"}</option>}
                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Job title
                      <input value={editPerson.jobTitle} onChange={(e) => setEditPerson({ ...editPerson, jobTitle: e.target.value })} className={inputClass} />
                    </label>
                    <label className={labelClass}>
                      Payment alias (name on bank payments)
                      <input value={editPerson.paymentAlias} onChange={(e) => setEditPerson({ ...editPerson, paymentAlias: e.target.value })} className={inputClass} />
                    </label>
                    <label className={labelClass}>
                      Status
                      <select value={editPerson.active ? "active" : "inactive"} onChange={(e) => setEditPerson({ ...editPerson, active: e.target.value === "active" })} className={inputClass}>
                        <option value="active">Active (still working)</option>
                        <option value="inactive">Inactive (has left)</option>
                      </select>
                    </label>
                  </div>
                  {personError && <p className="mt-2 text-status-alert">{personError}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setEditPerson(null)} disabled={busy === "person"} className={smallBtn}>Cancel</button>
                    <button onClick={savePersonEdit} disabled={busy === "person" || editPerson.fullName.trim().length < 2} className={primaryBtn}>
                      {busy === "person" ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                <span className="min-w-0 text-ink-300">
                  <span className="font-medium text-ink-50">{p.fullName}</span> · {p.department ?? "—"} · {p.jobTitle || <span className="text-status-alert">Job title missing</span>}
                  {!p.active && <span className="ml-1.5 rounded-full bg-status-inactive/15 px-1.5 py-0.5 text-[10px] text-status-inactive">Inactive</span>}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => startEditPerson(p)} className={smallBtn}>Edit</button>
                  <button onClick={() => chooseEmployee(p.id)} className={smallBtn}>Assign payments</button>
                </span>
              </div>
              )
            )}
          </div>
        </WidgetCard>
        </div>

        <div ref={findRef} className="scroll-mt-4">
        <WidgetCard title="Find payroll and commission payments">
          <p className="mb-3 text-xs text-ink-500">
            Choose an employee, then search payment descriptions, references, suppliers or IDs. This search works across all financial years,
            independently of dashboard filters.
          </p>
          <div className="space-y-2">
            <label className={labelClass}>
              Employee to receive selected payments
              <select
                value={selectedEmployee}
                onChange={(e) => chooseEmployee(e.target.value)}
                className={`${inputClass} normal-case tracking-normal ${!selectedEmployee && pickEntries.length ? "border-status-inactive ring-1 ring-status-inactive" : ""}`}
              >
                <option value="">Choose employee…</option>
                {people.filter((p) => p.active || p.id === selectedEmployee).map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.department ?? "—"})</option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(queryInput);
              }}
              className="flex gap-2"
            >
              <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="Employee name, supplier, payment ID, reference or commission" className={inputClass} />
              <button type="submit" className={smallBtn}>Search payments</button>
              <button type="button" onClick={() => { setQueryInput(""); setQuery(""); }} className={smallBtn}>Clear</button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-ink-500">
                <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                Has unallocated balance
              </label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "personnel" | "all")} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none">
                <option value="personnel">Salary and personnel costs</option>
                <option value="all">All payments</option>
              </select>
              <button
                disabled={!displayed.length}
                onClick={() => setPicks((prev) => { const next = { ...prev }; displayed.forEach((t) => addPick(t, next)); return next; })}
                className={smallBtn}
              >
                Select shown ({displayed.length})
              </button>
              <button disabled={!pickEntries.length} onClick={() => setPicks({})} className={smallBtn}>Clear selected</button>
            </div>
          </div>
          <div className="mt-2 flex max-h-[335px] flex-col gap-1 overflow-y-auto">
            {displayed.map((t) => {
              const left = balance(t);
              const used = (usedCents.get(t.id) ?? 0) / 100;
              const picked = Boolean(picks[t.id]);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="checkbox" checked={picked} disabled={!picked && left <= 0} title={left <= 0 ? "Fully allocated already" : undefined} onChange={(e) => togglePick(t, e.target.checked)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-50" title={t.description}>{t.description}</span>
                      <span className="block text-[10px] text-ink-500">
                        {t.date ? isoDate(t.date) : t.month} · {effectiveCentre(t) || "—"} · {usd(t.amount)} · Available {usd(left)}
                        {used ? ` · Already allocated ${usd(used)}` : ""}
                      </span>
                    </span>
                  </label>
                  <button onClick={() => openPayment(t.id)} className={`${smallBtn} shrink-0`}>Split / edit</button>
                </div>
              );
            })}
            {displayed.length === 0 && <p className="p-2 text-xs text-ink-500">No matching payments. Try a description, amount or reference. You can also choose All payments.</p>}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Showing {displayed.length} of {choices.length} matches. Tick multiple rows to add them below. Search matches payment descriptions across all years.
          </p>
        </WidgetCard>
        </div>
      </div>

      <div className="mt-4">
        <WidgetCard
          title={`Allocate selected payments to ${selectedName ?? "an employee"}`}
          action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{pickEntries.length} selected · {usd(pickTotal)}</span>}
        >
          <p className="mb-2 text-xs text-ink-500">Set a Simple cost head and USD amount for each payment (Spending Explorer uses the same cost head). Existing employee allocations are not overwritten.</p>
          {pickEntries.length ? (
            <div className="flex flex-col divide-y divide-base-800">
              {pickEntries.map(([id, p]) => {
                const t = txById.get(id);
                if (!t) return null;
                const set = (patch: Partial<Pick>) => setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
                return (
                  <div key={id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-50" title={t.description}>{t.description}</p>
                        <p className="text-[10px] text-ink-500">{t.date ? isoDate(t.date) : t.month} · {id} · {usd(t.amount)} original · {usd(balance(t))} available</p>
                      </div>
                      <button onClick={() => togglePick(t, false)} className={smallBtn}>Remove</button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className={labelClass}>
                        Simple cost head
                        <select value={p.costType} onChange={(e) => chooseCategory(e.target.value, (costType) => set({ costType }))} className={`${inputClass} normal-case tracking-normal`}>
                          {!categoryOptions.includes(p.costType) && <option value={p.costType}>{p.costType}</option>}
                          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                          <option value={NEW_CATEGORY}>+ Add new cost head…</option>
                        </select>
                      </label>
                      <label className={labelClass}>
                        Allocate USD
                        <input type="number" min="0.01" step="0.01" value={p.amountUsd} onChange={(e) => set({ amountUsd: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                      </label>
                      <label className={labelClass}>
                        Payroll/deal reference
                        <input maxLength={180} placeholder="Optional" value={p.reference} onChange={(e) => set({ reference: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-500">Tick payments in the search results above, and choose the employee who should receive them.</p>
          )}
          {pickEntries.length > 0 && !selectedEmployee && (
            <p className="mt-3 rounded-lg border border-status-inactive/40 bg-status-inactive/10 px-3 py-2 text-xs text-status-inactive">
              Choose the employee who should receive these payments in “Employee to receive selected payments” above.
            </p>
          )}
          <button onClick={saveBatch} disabled={!!busy || !selectedEmployee || !pickEntries.length} className={`${primaryBtn} mt-3`}>
            {busy === "batch"
              ? "Allocating…"
              : selectedEmployee
                ? `Allocate ${pickEntries.length} selected payments to ${selectedName ?? "employee"}`
                : `Allocate ${pickEntries.length} selected payments`}
          </button>
        </WidgetCard>
      </div>

      {editPayment && (
        <div className="mt-4">
          <WidgetCard
            title={`Split or edit a payment: ${editPayment.description}`}
            action={<button onClick={() => setEditPaymentId(null)} className="text-[11px] text-ink-500 hover:text-ink-300">Close</button>}
          >
            <p className="mb-3 text-xs text-ink-500">
              {editPayment.id} · {editPayment.date ? isoDate(editPayment.date) : editPayment.month} · Original amount {usd(editPayment.amount)}
            </p>
            <p className="mb-3 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300">
              This editor replaces the complete personnel allocation for ONE payment. Use it if a payroll transfer covers several people. The
              sum cannot exceed the original payment amount.
            </p>
            <div className="flex flex-col gap-2">
              {draftLines.map((line) => (
                <div key={line.key} className="grid grid-cols-1 gap-2 rounded-lg border border-base-700 bg-base-800 p-2 sm:grid-cols-6">
                  <select value={line.personId} onChange={(e) => updateLine(line.key, { personId: e.target.value })} className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none">
                    <option value="">Select employee</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.department ?? "—"})</option>)}
                  </select>
                  <select
                    value={line.costType}
                    title="Simple cost head"
                    onChange={(e) => chooseCategory(e.target.value, (costType) => updateLine(line.key, { costType }))}
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none"
                  >
                    {!categoryOptions.includes(line.costType) && <option value={line.costType}>{line.costType}</option>}
                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={NEW_CATEGORY}>+ Add new cost head…</option>
                  </select>
                  <input type="number" min="0.01" step="0.01" value={line.amountUsd} onChange={(e) => updateLine(line.key, { amountUsd: e.target.value })} placeholder="0.00" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <input value={line.reference} maxLength={180} onChange={(e) => updateLine(line.key, { reference: e.target.value })} placeholder="Deal, pay period or reference" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <input value={line.note} maxLength={500} onChange={(e) => updateLine(line.key, { note: e.target.value })} placeholder="Notes" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <button onClick={() => setDraftLines((prev) => prev.filter((l) => l.key !== line.key))} className="rounded-md border border-base-700 px-2 py-1.5 text-xs text-ink-500 hover:border-status-inactive/40 hover:text-status-inactive">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])} className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50">
                + Add allocation line
              </button>
              <button onClick={() => saveAllocation()} disabled={!!busy || draftLines.length === 0} className={primaryBtn}>
                {busy === "alloc" ? "Saving…" : "Save payment allocations"}
              </button>
              {hasExisting && (
                <button onClick={() => saveAllocation(true)} disabled={!!busy} className="rounded-lg border border-status-inactive/40 px-3 py-1.5 text-xs font-medium text-status-inactive hover:bg-status-inactive/10 disabled:opacity-50">
                  Remove allocations
                </button>
              )}
              <span className="text-[11px] text-ink-500">Lines total: {usd(draftTotal)} of {usd(editPayment.amount)}</span>
              {draftTotal > editPayment.amount + 0.001 && <span className="text-[11px] text-status-alert">Allocations exceed the original payment amount.</span>}
              {allocError && <span className="text-[11px] text-status-inactive">{allocError}</span>}
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4 scroll-mt-4" ref={historyRef}>
        <WidgetCard
          title={filterPerson !== "all" ? `Payments linked to ${people.find((p) => p.id === filterPerson)?.fullName ?? "this person"}` : "Commission and payroll history"}
          action={<Link href="/finance/history" className="text-[11px] text-ink-300 hover:text-ink-50">Change History ↗</Link>}
        >
          {historyMessage && (
            <p className={`mb-3 rounded-lg border px-3 py-2 text-xs ${historyMessage.kind === "ok" ? "border-status-active/40 bg-status-active/10 text-status-active" : "border-status-inactive/40 bg-status-inactive/10 text-status-inactive"}`}>
              {historyMessage.text}
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Simple cost head</th>
                  <th className="px-3 py-2">Source payment / reference</th>
                  <th className="px-3 py-2 text-right">Attributed USD</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{h.paymentDate ? String(h.paymentDate).slice(0, 10) : h.month}</td>
                    <td className="px-3 py-2 font-medium text-ink-50">{h.personName}</td>
                    <td className="px-3 py-2">{h.departmentSnapshot ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={personCostHead(h.costType)}
                        disabled={savingCategory === h.id}
                        onChange={(e) => chooseCategory(e.target.value, (costType) => changeCategory(h.id, costType))}
                        className="rounded-md border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none disabled:opacity-50"
                      >
                        {!categoryOptions.includes(personCostHead(h.costType)) && <option value={personCostHead(h.costType)}>{personCostHead(h.costType)}</option>}
                        {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value={NEW_CATEGORY}>+ Add new cost head…</option>
                      </select>
                    </td>
                    <td className="max-w-[280px] px-3 py-2">
                      <p className="truncate" title={h.paymentDescription}>{h.paymentDescription}</p>
                      <p className="text-[10px] text-ink-500">{h.reference || h.transactionId}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(h.amountUsd)}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">No allocations yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredAllocations.length > 200 && (
            <p className="mt-2 text-[11px] text-ink-500">
              Showing the latest 200 of {filteredAllocations.length.toLocaleString()} lines. Narrow the year, month, department or person for more detail.
            </p>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
