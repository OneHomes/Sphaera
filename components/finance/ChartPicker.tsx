"use client";

function usd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

export type PickerRow = { key: string; value: number; count: number };

/** null selection means "everything"; source selectionAllows(). */
export function selectionAllows(selected: Set<string> | null, key: string): boolean {
  return selected === null || selected.has(key);
}

/** Port of the source chartPicker(): multi-select checkboxes that scope the chart and payment list. */
export function ChartPicker({
  title,
  rows,
  selected,
  onChange,
}: {
  title: string;
  rows: PickerRow[];
  selected: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
}) {
  const n = selected === null ? rows.length : rows.filter((r) => selected.has(r.key)).length;
  function toggle(key: string) {
    const base = selected === null ? new Set(rows.map((r) => r.key)) : new Set(selected);
    if (base.has(key)) base.delete(key);
    else base.add(key);
    onChange(base.size === rows.length ? null : base);
  }
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-ink-50">{title}</h3>
          <p className="mt-1 text-[11px] text-ink-500">
            Tick several entries to compare their combined spending. Only the selected entries appear in the chart and
            payment list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
            {n} of {rows.length} selected
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
          >
            Clear all
          </button>
        </div>
      </div>
      <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const on = selectionAllows(selected, r.key);
          return (
            <label
              key={r.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                on ? "border-status-active/40 bg-status-active/5" : "border-base-700 hover:border-base-600"
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(r.key)} className="mt-0.5 accent-[#14b8a6]" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink-50">{r.key}</span>
                <span className="block text-[10px] text-ink-500">
                  {usd(r.value)} net · {r.count.toLocaleString()} payments
                </span>
              </span>
            </label>
          );
        })}
        {rows.length === 0 && <p className="text-[11px] text-ink-500">No cost heads available for these filters.</p>}
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        {selected === null ? "All available entries are included." : "Your selection is active for this view."} Click a
        chart slice to inspect one entry, or select multiple checkboxes to compare them together.
      </p>
    </div>
  );
}
