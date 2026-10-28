"use client";

import { Fragment, Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
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

function NavLink({ item, isActive }: { item: FinanceNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
        isActive ? "bg-base-800 text-ink-50" : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
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
          Back to main menu
        </Link>
        {FINANCE_NAV.map((item) => {
          if (item.payrollOnly && !canAccessFinancePayroll) return null;
          if (item.adminOnly && !isAdmin) return null;
          const node = <NavLink key={item.href} item={item} isActive={pathname === item.href} />;
          if (item.href !== BANKS_INSERT_AFTER) return node;
          // Insert the expandable "Banks" group right after Financial
          // Planning, matching the source NAV array's exact position.
          const banksActive = pathname === "/finance/banks" || pathname === "/finance/banks/funds";
          return (
            <Fragment key={item.href}>
              {node}
              <div>
                <button
                  type="button"
                  onClick={() => setBanksOpen((v) => !v)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                    banksActive ? "bg-base-800 text-ink-50" : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
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
