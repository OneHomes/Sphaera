// One shared money formatter.
//
// Before this file existed, ~20 components each carried a copy-pasted helper like
//   if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
// Those copies drifted and had real bugs: negatives rendered "$-1.50M" (while the
// non-compact path gave "-$1,500,000"), billions rendered "$2500.00M", and chart
// ticks could read "$250000K". Intl.NumberFormat handles sign placement, grouping
// and the K/M/B/T tiers correctly, so every surface should go through here.
//
// This module only formats. It never converts: pass the currency the value is
// already in (default USD, which is what every "$" surface showed before).

export type MoneyOptions = {
  /** ISO 4217 code of the value as stored. Defaults to "USD". */
  currency?: string;
  /** Compact notation: $1.5K, $1.5M, $2.5B. Values under 1,000 stay standard. */
  compact?: boolean;
  /**
   * Fixed fraction digits. Standard notation defaults to 0 (whole units, the
   * convention across finance tables). Compact defaults to 3 significant digits
   * ($1.23M, $12.3K, $123K) unless this is given.
   */
  decimals?: number;
};

const EMPTY = "—";
const cache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", options);
    cache.set(key, f);
  }
  return f;
}

export function formatMoney(value: number | null | undefined, opts: MoneyOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  const currency = opts.currency ?? "USD";
  const compact = Boolean(opts.compact) && Math.abs(value) >= 1000;

  if (compact && opts.decimals === undefined) {
    return formatter(`${currency}|c|sig3`, {
      style: "currency",
      currency,
      notation: "compact",
      maximumSignificantDigits: 3,
      signDisplay: "auto",
    }).format(value);
  }

  const decimals = Math.max(0, Math.min(20, opts.decimals ?? 0));
  // Round first and add 0 so -0.4 shows as "$0", not "-$0".
  const v = compact ? value : Number(value.toFixed(decimals)) + 0;
  return formatter(`${currency}|${compact ? "c" : "s"}|${decimals}`, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: decimals,
    signDisplay: "auto",
  }).format(v);
}

/** Chart axis ticks: always compact, at most one decimal ($0, $500, $250K, $1.5M). */
export function formatMoneyAxis(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return formatter(`${currency}|axis`, {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    signDisplay: "auto",
  }).format(value);
}
