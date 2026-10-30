"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FinanceState } from "@/lib/finance/ledgerData";

// The Finance ledger (every payment with its classification) is loaded into the browser ONCE
// and shared by all Finance screens, like the original app's DATA object: switching screens
// no longer re-downloads ~3.6 MB per click. Security is unchanged: /api/finance/ledger/state
// still checks Finance access and returns only a department-limited user's departments, every
// save is validated server-side, and the data lives in memory only (never localStorage), so
// it is gone when the tab closes or the user signs out.
//
// Freshness: any successful Finance save (POST/PATCH/PUT/DELETE to /api/finance/*) triggers a
// background reload, as does returning to the tab after a while and a 5-minute timer.

type FinanceData = {
  state: FinanceState | null;
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
};

const FinanceDataContext = createContext<FinanceData>({
  state: null,
  error: null,
  loading: true,
  lastUpdated: null,
  refresh: async () => {},
});

const REFRESH_EVERY_MS = 5 * 60_000;
const REFRESH_ON_FOCUS_AFTER_MS = 60_000;
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Read-only endpoints that use POST (previews/validation) must not trigger a reload.
const NON_WRITE_POSTS = [/\/preview$/, /\/validate$/, /\/split-preview$/, /\/workbook$/, /\/chat$/, /\/template$/];

function reviveDates(state: FinanceState): FinanceState {
  // JSON turns Date into strings; the screens were written against Date objects.
  for (const t of state.transactions) {
    if (t.date) (t as { date: Date | null }).date = new Date(t.date as unknown as string);
  }
  return state;
}

export function FinanceDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const lastUpdatedRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    // Coalesce: if a load is running, run exactly one more after it (a save may have landed mid-load).
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = (async () => {
      do {
        again.current = false;
        setLoading(true);
        try {
          const res = await fetch("/api/finance/ledger/state", { cache: "no-store" });
          if (!res.ok) throw new Error(res.status === 403 ? "You don't have access to Finance data." : "Could not load Finance data.");
          const next = reviveDates((await res.json()) as FinanceState);
          setState(next);
          setError(null);
          const now = Date.now();
          lastUpdatedRef.current = now;
          setLastUpdated(now);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load Finance data.");
        } finally {
          setLoading(false);
        }
      } while (again.current);
    })();
    inflight.current = run;
    try {
      await run;
    } finally {
      inflight.current = null;
    }
  }, []);

  // First load.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Reload after any successful Finance save, wherever it happens on the page.
  useEffect(() => {
    const original = window.fetch;
    const wrapped: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        const path = new URL(url, window.location.origin).pathname;
        if (
          res.ok &&
          WRITE_METHODS.has(method) &&
          path.startsWith("/api/finance/") &&
          !NON_WRITE_POSTS.some((re) => re.test(path))
        ) {
          void refresh();
        }
      } catch {
        // Never let bookkeeping break the caller's request.
      }
      return res;
    };
    window.fetch = wrapped;
    return () => {
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, [refresh]);

  // Returning to the tab, and a slow timer, pick up other people's changes.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const at = lastUpdatedRef.current;
      if (!at || Date.now() - at > REFRESH_ON_FOCUS_AFTER_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [refresh]);

  return (
    <FinanceDataContext.Provider value={{ state, error, loading, lastUpdated, refresh }}>{children}</FinanceDataContext.Provider>
  );
}

export function useFinanceData() {
  return useContext(FinanceDataContext);
}

/** Renders children with the shared ledger once it has loaded (a loader or error until then). */
export function WithFinanceState({ children }: { children: (state: FinanceState) => React.ReactNode }) {
  const { state, error, refresh } = useFinanceData();
  if (state) return <>{children(state)}</>;
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs text-status-inactive">
        {error}
        <button onClick={() => void refresh()} className="rounded-lg border border-base-700 px-3 py-1.5 text-ink-300 hover:text-ink-50">
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-xs text-ink-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading finance data…
    </div>
  );
}
