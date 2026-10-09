"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

type Role = "AGENT" | "MANAGER" | "ADMIN";

export function LeftRail({ role }: { role?: Role }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && role !== "ADMIN") return false;
    if (item.managerAndAbove && role === "AGENT") return false;
    return true;
  });

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-14 flex-col items-center justify-between border-r border-base-700 bg-base-950 py-4"
    >
      <div className="flex flex-col items-center gap-1">
        {visibleItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
                isActive
                  ? "bg-base-800 text-ink-50"
                  : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-base-800 px-2 py-1 text-xs text-ink-50 opacity-0 shadow-lg transition group-hover:opacity-100 z-20">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500">
        <SphaeraGlyph className="h-5 w-5" />
      </div>
    </nav>
  );
}

// Official Sphaera icon mark (from the brand asset handover), rendered
// inline with currentColor so it inherits the rail's hover/active theming
// the same way the previous placeholder glyph did.
function SphaeraGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 210 206" fill="none" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M100.092 144.333C128.789 144.333 152.273 120.881 152.273 92.2229H167.181C167.181 129.072 136.991 159.221 100.092 159.221C63.1932 159.221 33 129.072 33 92.2229H47.9077C47.9077 120.881 71.3913 144.333 100.092 144.333ZM100.092 69.8876C87.7913 69.8876 77.7269 79.9385 77.7269 92.2229C77.7269 104.507 87.7913 114.554 100.092 114.554C112.393 114.554 122.454 104.511 122.454 92.2229C122.454 79.9347 112.389 69.8876 100.092 69.8876ZM62.8192 92.2229C62.8192 71.7476 79.5894 55 100.092 55C120.595 55 137.358 71.7476 137.358 92.2229C137.358 112.698 120.588 129.446 100.092 129.446C79.597 129.446 62.8192 112.691 62.8192 92.2229ZM197 92.2229C197 145.454 153.388 189 100.092 189V174.112C145.186 174.112 182.085 137.263 182.085 92.2229H196.996H197Z"
        fill="currentColor"
      />
    </svg>
  );
}