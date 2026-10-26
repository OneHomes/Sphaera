"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileClock,
  PieChart,
  Receipt,
  Inbox,
  AlertTriangle,
  History as HistoryIcon,
  FolderTree,
  Tags,
  ClipboardList,
  Landmark,
  CreditCard,
  Link2,
  Store,
  UploadCloud,
  Network,
  Users,
  Sparkles,
  DatabaseBackup,
} from "lucide-react";

type FinanceNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  payrollOnly?: boolean;
};

type FinanceNavSection = {
  label: string;
  items: FinanceNavItem[];
};

const FINANCE_NAV: FinanceNavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/finance", label: "CEO Overview", icon: LayoutDashboard },
      { href: "/finance/weekly-brief", label: "Weekly CEO Brief", icon: FileClock },
      { href: "/finance/explorer", label: "Spending Explorer", icon: PieChart },
    ],
  },
  {
    label: "Ledger",
    items: [
      { href: "/finance/payments", label: "All Payments", icon: Receipt },
      { href: "/finance/needs-allocation", label: "Needs Allocation", icon: Inbox },
      { href: "/finance/disputes", label: "Disputed Charges", icon: AlertTriangle },
      { href: "/finance/historical-debt", label: "Historical Debt", icon: HistoryIcon },
      { href: "/finance/organise", label: "Organise Costs", icon: FolderTree },
      { href: "/finance/cost-heads", label: "Cost Heads", icon: Tags },
      { href: "/finance/history", label: "Change History", icon: ClipboardList },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/finance/budget", label: "Budget vs Actual", icon: PieChart },
      { href: "/finance/planning", label: "Financial Planning", icon: FileClock },
    ],
  },
  {
    label: "Overheads & People",
    items: [
      { href: "/finance/overheads", label: "Overhead Analysis", icon: FolderTree },
      { href: "/finance/people", label: "People Costs", icon: Users, payrollOnly: true },
    ],
  },
  {
    label: "Treasury",
    items: [
      { href: "/finance/banks", label: "Banks", icon: Landmark },
      { href: "/finance/credit-cycle", label: "Credit Cycle", icon: CreditCard },
      { href: "/finance/traceability", label: "Payment Traceability", icon: Link2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/finance/merchant", label: "Merchant Reconciliation", icon: Store },
      { href: "/finance/upload", label: "Upload New Months", icon: UploadCloud },
      { href: "/finance/erp", label: "ERP Connections", icon: Network },
      { href: "/finance/backups", label: "Data & Backups", icon: DatabaseBackup, payrollOnly: true },
    ],
  },
  {
    label: "Assistant",
    items: [{ href: "/finance/ask", label: "Ask Your Data", icon: Sparkles }],
  },
];

export function FinanceShell({
  children,
  canAccessFinancePayroll,
}: {
  children: React.ReactNode;
  canAccessFinancePayroll: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 w-full">
      <nav
        aria-label="Finance"
        className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-base-700 bg-base-900 p-3"
      >
        {FINANCE_NAV.map((section) => {
          const visibleItems = section.items.filter((item) => !item.payrollOnly || canAccessFinancePayroll);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "bg-base-800 text-ink-50"
                          : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
