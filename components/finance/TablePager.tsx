"use client";

import { useEffect, useState } from "react";

const PAGE_SIZE = 10;

/** Source applySmartPagination(): tables with more than 12 rows page 10 at a time. */
export function useTablePager<T>(rows: T[]) {
  const [page, setPage] = useState(0);
  const paged = rows.length > 12;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, pages - 1));
  }, [pages]);
  const begin = paged ? page * PAGE_SIZE : 0;
  const end = paged ? Math.min(rows.length, begin + PAGE_SIZE) : rows.length;
  const pageRows = rows.slice(begin, end);
  const pager = paged ? (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-700 px-3 py-2.5 text-[11px] text-ink-500">
      <span>
        Showing {begin + 1} to {end} of {rows.length} records
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <strong className="text-ink-50">
          Page {page + 1} of {pages}
        </strong>
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  ) : null;
  return { pageRows, pager };
}
