"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

export function LeftRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-14 flex-col items-center justify-between border-r border-base-700 bg-base-950 py-4"
    >
      <div className="flex flex-col items-center gap-1">
        {navItems.map((item) => {
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

function SphaeraGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 17c0-2.4 2-4.8 3.4-4.8M19 17c0-2.4-2-4.8-3.4-4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
