"use client";

import { Fragment, Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { FinanceFilterProvider } from "./FinanceFilterContext";
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

// Direct port of the source's persistent header (index.html line 537's
// `<header class="top">` — the "SPHAERA / FINANCIAL INTELLIGENCE" eyebrow
// plus "↻ Refresh" / "+ Import monthly data") — global, shown above the
// filter bar on every Finance screen, not just Overview. Each screen's
// own page title/subtitle render below this, untouched.
function FinanceActionBar() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-base-800 bg-base-900 px-6 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Sphaera / Financial Intelligence</div>
      <div className="flex items-center gap-2">
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
        className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-base-700 bg-base-900 p-3"
      >
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
        <FinanceActionBar />
        <Suspense fallback={null}>
          <FinanceFilterProvider>
            <FinanceFilterBar options={filterOptions} />
            {children}
          </FinanceFilterProvider>
        </Suspense>
      </div>
    </div>
  );
}
