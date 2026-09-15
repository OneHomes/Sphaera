"use client";

import { useState } from "react";
import type { ReactNode } from "react";

// Mission Centre and the widget grid used to be stacked on one long
// scroll. Per feedback comparing against the reference UI (which shows
// Dashboard as its own widgets-only screen), they're now separated into
// tabs on the same route instead of two different pages — keeps the
// "today's mission" and "analytics" concerns visually distinct without
// adding a second nav entry for what's still fundamentally one screen.
export function DashboardTabs({
  mission,
  dashboard,
}: {
  mission: ReactNode;
  dashboard: ReactNode;
}) {
  const [tab, setTab] = useState<"mission" | "dashboard">("mission");

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-base-700 px-6 pt-5">
        <TabButton active={tab === "mission"} onClick={() => setTab("mission")}>
          Mission
        </TabButton>
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Dashboard
        </TabButton>
      </div>

      <div className={tab === "mission" ? "px-6 py-6" : ""}>
        {tab === "mission" ? mission : dashboard}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 pb-3 text-sm font-medium transition ${
        active
          ? "border-status-active text-ink-50"
          : "border-transparent text-ink-500 hover:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}
