"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, GripVertical, RefreshCw, X } from "lucide-react";
import { FinanceFilterProvider, FinanceLookupProvider, useFinanceFilters } from "./FinanceFilterContext";
import { FinanceFilterBar } from "./FinanceFilterBar";
import type { FinanceFilterOptions } from "@/lib/finance/ledgerData";
import {
  LayoutDashboard,
  PieChart,
  FileClock,
  Landmark,
  CreditCard,
  Mail,
  Tags,
  FolderTree,
  Users,
  FileSpreadsheet,
  Target,
  Receipt,
  ClipboardList,
  AlertTriangle,
  History as HistoryIcon,
  History as DebtIcon,
  Link2,
  Store,
  UploadCloud,
  Network,
  Sparkles,
  Settings,
  ChevronDown,
  Building2,
  Wallet,
  ShieldCheck,
} from "lucide-react";

// Exact order/grouping of the source app's NAV array (index.html:549) —
// a flat list, with "Banks" as the ONLY item that expands into children
// (Bank Accounts / Treasury Funds). This is a structural/content port of
// the original layout, not a redesign — only the color palette and
// component implementation are Sphaera's.
type FinanceNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  payrollOnly?: boolean;
  adminOnly?: boolean;
};

const FINANCE_NAV: FinanceNavItem[] = [
  { href: "/finance", label: "CEO Overview", icon: LayoutDashboard },
  { href: "/finance/budget", label: "Budget vs Actual", icon: PieChart },
  { href: "/finance/planning", label: "Financial Planning", icon: FileClock },
  // "Banks" is rendered specially below (expandable), not from this array.
  { href: "/finance/credit-cycle", label: "Credit Cycle", icon: CreditCard },
  { href: "/finance/weekly-brief", label: "Weekly CEO Brief", icon: Mail },
  { href: "/finance/cost-heads", label: "Cost Heads", icon: Tags },
  { href: "/finance/overheads", label: "Overhead Analysis", icon: FolderTree },
  { href: "/finance/people", label: "People Costs", icon: Users, payrollOnly: true },
  { href: "/finance/payroll", label: "Payroll Import", icon: FileSpreadsheet, payrollOnly: true },
  { href: "/finance/explorer", label: "Spending Explorer", icon: Target },
  { href: "/finance/payments", label: "All Payments", icon: Receipt },
  { href: "/finance/organise", label: "Organise Costs", icon: FolderTree },
  { href: "/finance/needs-allocation", label: "Needs Allocation", icon: AlertTriangle },
  { href: "/finance/disputes", label: "Disputed Charges", icon: AlertTriangle },
  { href: "/finance/history", label: "Change History", icon: ClipboardList },
  { href: "/finance/historical-debt", label: "Historical Debt", icon: DebtIcon },
  { href: "/finance/traceability", label: "Payment Traceability", icon: Link2 },
  { href: "/finance/merchant", label: "Merchant Reconciliation", icon: Store },
  { href: "/finance/upload", label: "Upload New Months", icon: UploadCloud },
  { href: "/finance/erp", label: "ERP Connections", icon: Network },
  { href: "/finance/ask", label: "Ask Your Data", icon: Sparkles },
  { href: "/finance/backups", label: "Data & Backups", icon: Settings, payrollOnly: true },
  { href: "/finance/admin/department-access", label: "Department Access", icon: ShieldCheck, adminOnly: true },
];

const BANK_CHILDREN = [
  { href: "/finance/banks", label: "Bank Accounts", icon: Building2 },
  { href: "/finance/banks/funds", label: "Treasury Funds", icon: Wallet },
];

// "Banks" sits where it does in the source NAV array (right after
// Financial Planning) — inserted at render time below rather than listed
// in FINANCE_NAV, since it's the one item with children.
const BANKS_INSERT_AFTER = "/finance/planning";
const BANKS_ID = "banks";

// Source "Organise your sidebar" (index.html sidebarEditor*): a per-browser order of the
// top-level sections kept in localStorage. Navigation only, never data.
const SIDEBAR_ORDER_KEY = "sphaera.finance.sidebar.order.v1";
const DEFAULT_ORDER: string[] = FINANCE_NAV.flatMap((item) =>
  item.href === BANKS_INSERT_AFTER ? [item.href, BANKS_ID] : [item.href]
);

/** Keeps known ids in the saved order and appends any section added since the order was saved. */
function normaliseOrder(saved: unknown): string[] {
  const list = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && DEFAULT_ORDER.includes(id)) : [];
  const unique = Array.from(new Set(list));
  return [...unique, ...DEFAULT_ORDER.filter((id) => !unique.includes(id))];
}

function sectionLabel(id: string) {
  if (id === BANKS_ID) return { label: "Banks", icon: Landmark };
  const item = FINANCE_NAV.find((x) => x.href === id);
  return { label: item?.label ?? id, icon: item?.icon ?? LayoutDashboard };
}

function SidebarEditor({
  order,
  visible,
  onSave,
  onClose,
}: {
  order: string[];
  visible: (id: string) => boolean;
  onSave: (order: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(order);
  const [dragId, setDragId] = useState<string | null>(null);
  const shown = draft.filter(visible);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Moves within the visible list; hidden sections (payroll/admin-only) keep their slots.
  function move(id: string, toShownIndex: number) {
    const from = shown.indexOf(id);
    const dest = Math.max(0, Math.min(shown.length - 1, toShownIndex));
    if (from < 0 || from === dest) return;
    const nextShown = [...shown];
    nextShown.splice(from, 1);
    nextShown.splice(dest, 0, id);
    let k = 0;
    setDraft(draft.map((x) => (visible(x) ? nextShown[k++] : x)));
  }

  const arrowBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-base-700 text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebarEditorTitle"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-base-700 bg-base-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-base-700 px-5 py-4">
          <h2 id="sidebarEditorTitle" className="text-lg font-bold text-ink-50">Organise your sidebar</h2>
          <button type="button" onClick={onClose} aria-label="Close sidebar editor" className={arrowBtn}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-ink-500">
          Drag a section to a new position, or use the ↑ and ↓ buttons. Click <strong className="text-ink-300">Save order</strong> when
          you&apos;re happy. This changes navigation only, never transactions or budgets.
        </p>
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3" aria-label="Reorder navigation sections">
          {shown.map((id, i) => {
            const { label, icon: Icon } = sectionLabel(id);
            return (
              <li
                key={id}
                draggable
                onDragStart={(e) => {
                  setDragId(id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== id) move(dragId, i);
                }}
                onDragEnd={() => setDragId(null)}
                className={`flex cursor-grab items-center gap-3 rounded-xl border px-3 py-2 ${
                  dragId === id ? "border-status-active bg-base-800" : "border-base-700 bg-base-800/50"
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-ink-500" />
                <span className="w-6 text-right text-xs text-ink-500">{i + 1}.</span>
                <Icon className="h-4 w-4 shrink-0 text-status-active" strokeWidth={1.75} />
                <span className="flex-1 text-sm font-semibold text-ink-50">{label}</span>
                <button type="button" onClick={() => move(id, i - 1)} disabled={i === 0} aria-label={`Move ${label} up`} className={arrowBtn}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, i + 1)}
                  disabled={i === shown.length - 1}
                  aria-label={`Move ${label} down`}
                  className={arrowBtn}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center justify-between gap-2 border-t border-base-700 px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_ORDER)}
            className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:text-ink-50"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:text-ink-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-lg bg-status-active px-4 py-2 text-xs font-semibold text-base-950 hover:brightness-110"
            >
              Save order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, isActive }: { item: FinanceNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
        isActive ? "bg-[#efede8] font-semibold text-[#111111]" : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

// Direct port of the source's renderTop() — `pageTitle` is just the
// current NAV entry's label (index.html's own NAV array), never
// page-specific computed text, so it's derivable here with zero changes
// to any of the 22 screen components.
function getPageTitle(pathname: string): string {
  const all = [...FINANCE_NAV, ...BANK_CHILDREN];
  return all.find((item) => item.href === pathname)?.label ?? FINANCE_NAV[0].label;
}

function fyLabel(year: number): string {
  return `FY${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

// Direct port of renderTop()'s pageSubtitle ternary — static per screen,
// except the default branch (every "viewing cost data" screen) which
// reflects the global Financial year filter.
function getPageSubtitle(pathname: string, fy: string): string {
  if (pathname === "/finance/ask") return "Ask questions grounded in your own transaction database";
  if (pathname === "/finance/banks" || pathname === "/finance/banks/funds") {
    return "Fund-level balances, actual bank snapshots and future settlement forecasts";
  }
  if (pathname === "/finance/credit-cycle") return "Track invoices, card settlements, salary paydays and cash requirements";
  if (pathname === "/finance/people") return "Attribute salary, commission and employer costs to each person without changing the ledger";
  if (pathname === "/finance/disputes") return "Flag questionable payments for investigation with Finance";
  if (pathname === "/finance/history") return "Review, audit and safely undo eligible changes";
  if (pathname === "/finance/organise") return "Simplify historical source accounts into your departments and reusable cost heads";
  if (pathname === "/finance/upload") return "Incrementally import future months with duplicate protection";
  if (pathname === "/finance/erp") return "Three geographic ERPs, Finance-tagged S&M / Development allocations and bank mapping";
  const fyPart = fy === "all" ? "All financial years" : fyLabel(Number(fy));
  return `${fyPart} · Financial year November to October · Reporting currency USD`;
}

// Direct port of the source's persistent header (index.html line 537's
// `<header class="top">`) — eyebrow + page title + subtitle on the left,
// "↻ Refresh" / "+ Import monthly data" on the right, all in one row,
// global on every Finance screen. Must render inside FinanceFilterProvider
// (the subtitle's default branch reflects the Financial year filter).
function FinanceActionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { filters } = useFinanceFilters();
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="flex items-start justify-between gap-4 border-b border-base-800 px-6 py-4">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Sphaera / Financial Intelligence</div>
        <h1 className="mt-1 text-xl font-bold text-ink-50">{getPageTitle(pathname)}</h1>
        <p className="mt-1 text-xs text-ink-500">{getPageSubtitle(pathname, filters.fy)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.75} />
          Refresh
        </button>
        <Link
          href="/finance/upload"
          className="flex items-center gap-1.5 rounded-lg bg-status-active px-3 py-1.5 text-xs font-medium text-base-950 hover:brightness-110"
        >
          <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.75} />
          Import monthly data
        </Link>
      </div>
    </div>
  );
}

export function FinanceShell({
  children,
  canAccessFinancePayroll,
  isAdmin,
  filterOptions,
}: {
  children: React.ReactNode;
  canAccessFinancePayroll: boolean;
  isAdmin: boolean;
  filterOptions: FinanceFilterOptions;
}) {
  const pathname = usePathname();
  const [banksOpen, setBanksOpen] = useState(
    pathname === "/finance/banks" || pathname === "/finance/banks/funds"
  );
  // Read after mount so the server render (default order) and first client render match.
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    try {
      setOrder(normaliseOrder(JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || "null")));
    } catch {
      setOrder(DEFAULT_ORDER);
    }
  }, []);

  const isVisible = (id: string) => {
    const item = FINANCE_NAV.find((x) => x.href === id);
    if (!item) return id === BANKS_ID;
    return !(item.payrollOnly && !canAccessFinancePayroll) && !(item.adminOnly && !isAdmin);
  };

  function saveOrder(next: string[]) {
    const clean = normaliseOrder(next);
    setOrder(clean);
    try {
      localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(clean));
    } catch {
      // Storage blocked (private mode): the order still applies for this visit.
    }
    setEditorOpen(false);
  }

  const banksActive = pathname === "/finance/banks" || pathname === "/finance/banks/funds";

  return (
    <div className="flex h-full min-h-0 w-full">
      <nav
        aria-label="Finance"
        className="theme-dark flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-base-700 bg-base-900 p-3"
      >
        {/* The main Sphaera rail is hidden inside Finance (LeftRail), so this is the way back out. */}
        <Link
          href="/dashboard"
          className="mb-2 flex items-center gap-2 rounded-lg border border-base-700 px-2 py-1.5 text-xs font-medium text-ink-300 transition hover:bg-base-800 hover:text-ink-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Apex
        </Link>
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Navigation</span>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            aria-label="Organise sidebar"
            className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-0.5 text-[11px] font-medium text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <ArrowUpDown className="h-3 w-3" />
            Edit
          </button>
        </div>
        {order.map((id) => {
          if (!isVisible(id)) return null;
          if (id !== BANKS_ID) {
            const item = FINANCE_NAV.find((x) => x.href === id)!;
            return <NavLink key={id} item={item} isActive={pathname === item.href} />;
          }
          // The expandable "Banks" group (default position: right after Financial Planning).
          return (
            <Fragment key={id}>
              <div>
                <button
                  type="button"
                  onClick={() => setBanksOpen((v) => !v)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                    banksActive ? "text-ink-50 hover:bg-base-800" : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
                  }`}
                >
                  <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="flex-1 text-left">Banks</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${banksOpen ? "rotate-180" : ""}`}
                    strokeWidth={1.75}
                  />
                </button>
                {banksOpen && (
                  <div className="ml-5 flex flex-col gap-0.5 border-l border-base-800 pl-2">
                    {BANK_CHILDREN.map((child) => (
                      <NavLink key={child.href} item={child} isActive={pathname === child.href} />
                    ))}
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </nav>
      {editorOpen && (
        <SidebarEditor order={order} visible={isVisible} onSave={saveOrder} onClose={() => setEditorOpen(false)} />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <Suspense fallback={null}>
          <FinanceFilterProvider>
            <FinanceActionBar />
            <FinanceFilterBar options={filterOptions} />
            <FinanceLookupProvider paymentSources={filterOptions.paymentSources} subscriptions={filterOptions.subscriptions}>
              {children}
            </FinanceLookupProvider>
          </FinanceFilterProvider>
        </Suspense>
      </div>
    </div>
  );
}
