"use client";

import { useEffect, useMemo, useState } from "react";

// Shared "first 10, then Show more" behaviour for Finance lists (One Homes request), plus a small
// per-list search box for lists that had no filter of their own.

export const LIST_PAGE = 10;

/**
 * Returns the visible slice of `items` and the controls' state. The limit resets to 10 whenever
 * `resetKey` changes (e.g. a filter or search changed), so a new result always starts short.
 */
export function useShowMore<T>(items: T[], resetKey: unknown = null, page = LIST_PAGE) {
  const [limit, setLimit] = useState(page);
  useEffect(() => setLimit(page), [resetKey, page]);
  return {
    visible: items.length > limit ? items.slice(0, limit) : items,
    total: items.length,
    limit,
    showMore: () => setLimit((n) => n + page * 5),
    showAll: () => setLimit(items.length),
    showLess: () => setLimit(page),
  };
}

/** "Showing 10 of 240 · Show 50 more · Show all · Show less". Renders nothing for short lists. */
export function ShowMoreBar({
  state,
  className = "",
}: {
  state: { total: number; limit: number; showMore: () => void; showAll: () => void; showLess: () => void };
  className?: string;
}) {
  const { total, limit } = state;
  if (total <= LIST_PAGE) return null;
  const shown = Math.min(limit, total);
  const btn = "rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50";
  return (
    <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-500 ${className}`}>
      <span>
        Showing {shown.toLocaleString()} of {total.toLocaleString()}
      </span>
      {shown < total && (
        <>
          <button type="button" onClick={state.showMore} className={btn}>
            Show {Math.min(LIST_PAGE * 5, total - shown).toLocaleString()} more
          </button>
          <button type="button" onClick={state.showAll} className={btn}>
            Show all
          </button>
        </>
      )}
      {shown > LIST_PAGE && (
        <button type="button" onClick={state.showLess} className={btn}>
          Show less
        </button>
      )}
    </div>
  );
}

/** Case-insensitive text filter over the given fields. */
export function useListSearch<T>(items: T[], fields: (item: T) => Array<string | number | null | undefined>) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => fields(item).some((f) => f != null && String(f).toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);
  return { query, setQuery, filtered };
}

export function ListSearch({
  value,
  onChange,
  placeholder = "Filter this list…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full max-w-xs rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500 ${className}`}
    />
  );
}
