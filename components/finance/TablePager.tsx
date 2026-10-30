"use client";

import { ShowMoreBar, useShowMore } from "./ShowMore";

/**
 * Source applySmartPagination() paged tables 10 at a time; Sphaera (One Homes request) shows the
 * first 10 rows with "Show more" / "Show all" instead of Previous / Next pages.
 */
export function useTablePager<T>(rows: T[]) {
  const more = useShowMore(rows, rows.length);
  const pager = more.total > more.visible.length || more.limit > 10 ? (
    <div className="border-t border-base-700 px-3 pb-2.5">
      <ShowMoreBar state={more} />
    </div>
  ) : null;
  return { pageRows: more.visible, pager };
}
