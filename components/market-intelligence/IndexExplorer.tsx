"use client";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowUpRight, Download, TrendingUp, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { data, cities, segments, money, periodLabel, dateLabel, type Currency } from "@/lib/marketIntelligence/insights";
import { histories, chartData, filterHistories, change, monthNumber, type Metric } from "@/lib/marketIntelligence/indexEngine";

const indexSegments: { [key: string]: string } = { houses: "Houses", flats: "Apartments", residential_plots: "Residential Plots", commercial_plots: "Commercial Plots" };

function Pick({ title, value, options, set }: { title: string; value: string; options: [string, string][]; set: (v: string) => void }) {
  return (
    <label className="picker">
      <span>{title}</span>
      <Select value={value} onValueChange={set}>
        <SelectTrigger aria-label={title}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, t]) => (
            <SelectItem key={v} value={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
const palette = ["#0b0b0b", "#666660", "#757570"];
const maxHistoryYears = Math.max(10, ...histories.map((s) => Math.ceil((monthNumber(s.points.at(-1)!.period) - monthNumber(s.points[0].period) + 1) / 12)));
const timeRanges: [string, string][] = [
  ["0", "All time"],
  ["6", "6 months"],
  ...Array.from({ length: maxHistoryYears }, (_, i): [string, string] => [String((i + 1) * 12), `${i + 1} ${i === 0 ? "year" : "years"}`]),
];
export default function IndexExplorer() {
  const [city, setCity] = useState("Lahore");
  const [segment, setSegment] = useState("houses");
  const [purpose, setPurpose] = useState("buy");
  const [metric, setMetric] = useState<Metric>("price");
  const [range, setRange] = useState("0");
  const [currency, setCurrency] = useState<Currency>("PKR");
  const [compare, setCompare] = useState<string[]>([]);
  const effectiveArea = "Citywide";
  const effectiveSize = "All sizes";
  const matching = filterHistories({ city, segment, purpose });
  const primary = matching.find((s) => s.area === effectiveArea && s.size === effectiveSize);
  const selected = primary
    ? [primary, ...histories.filter((s) => compare.includes(s.id) && s.id !== primary.id && s.segment === segment && s.purpose === purpose && s.size === effectiveSize)].slice(0, 3)
    : [];
  const hasPpsf = selected.some((s) => s.points.some((p) => p.ppsf !== null));
  const hasSourceIndex = selected.some((s) => s.points.some((p) => p.sourceIndex !== null));
  const metricOptions: [string, string][] = (
    [
      ["price", "Average asking price"],
      ["ppsf", "Price per square foot"],
      ["rebased", "Comparison index, base 100"],
      ["sourceIndex", "Published source index"],
    ] as [string, string][]
  ).filter(([key]) => key === "price" || key === "rebased" || (key === "ppsf" && hasPpsf) || (key === "sourceIndex" && hasSourceIndex));
  const chart = useMemo(() => chartData(selected, metric, Number(range), data.fx.rates[currency]), [primary, compare, metric, range, currency]);
  const availablePeriods = selected.flatMap((s) => s.points.map((p) => monthNumber(p.period)));
  const availableMonths = availablePeriods.length ? Math.max(...availablePeriods) - Math.min(...availablePeriods) + 1 : 0;
  const visiblePoints = primary?.points.filter((p) => chart.rows.some((r) => r.period === p.period)) || [];
  useEffect(() => {
    setCompare([]);
  }, [segment, purpose]);
  useEffect(() => {
    if ((metric === "ppsf" && !hasPpsf) || (metric === "sourceIndex" && !hasSourceIndex)) setMetric("price");
  }, [metric, hasPpsf, hasSourceIndex]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("series");
    const s = histories.find((s) => s.id === id);
    if (s) {
      setCity(s.city);
      setSegment(s.segment);
      setPurpose(s.purpose);
    }
  }, []);
  function exportHistory() {
    const rows = [
      ["City", "Area", "Segment", "Purpose", "Size", "Month", "Asking PKR", "PKR per sq ft", "Published source index", "Source URL"],
      ...selected.flatMap((s) =>
        s.points.filter((p) => chart.rows.some((r) => r.period === p.period)).map((p) => [s.city, s.area, s.segment, s.purpose, s.size, p.period, p.price, p.ppsf ?? "", p.sourceIndex ?? "", s.url])
      ),
    ];
    const csv = rows.map((r) => r.map((x) => '"' + String(x).replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sphaera-index-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const latest = primary?.points.at(-1);
  const previousMonth = primary ? change(primary, 1) : null;
  const annual = primary ? change(primary, 12) : null;
  const display = (value: number) =>
    metric === "rebased" || metric === "sourceIndex" ? value.toLocaleString("en-GB", { maximumFractionDigits: 1 }) : new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  return (
    <section className="index-workbench">
      <div className="section-heading">
        <div>
          <div className="eyebrow">THE PROPERTY INDEX</div>
          <h2>Explore the market through time</h2>
          <p>Citywide asking prices are shown at the all-sizes level for consistent comparison.</p>
        </div>
        <span className="pill">{histories.length} available histories</span>
      </div>
      <div className="filters index-filters">
        <Pick title="Index city" value={city} set={setCity} options={cities.map((c) => [c, c])} />
        <Pick
          title="Index segment"
          value={segment}
          set={(v) => {
            setSegment(v);
            setCompare([]);
          }}
          options={Object.entries(indexSegments)}
        />
        <Pick
          title="Sale or rent"
          value={purpose}
          set={(v) => {
            setPurpose(v);
            setCompare([]);
          }}
          options={[
            ["buy", "For sale"],
            ["rent", "Monthly rent"],
          ]}
        />
        <div className="fixed-filter">
          <span>Area</span>
          <strong>Citywide</strong>
        </div>
        <div className="fixed-filter">
          <span>Property size</span>
          <strong>All sizes</strong>
        </div>
      </div>
      {!primary ? (
        <div className="empty-state">
          <TrendingUp size={32} />
          <h2>No verified history for this selection</h2>
          <p>The area snapshot may be available, but it cannot be turned into a historical chart without dated observations.</p>
          <button
            className="secondary-button"
            onClick={() => {
              setCity("Lahore");
              setSegment("houses");
              setPurpose("buy");
            }}
          >
            View available Lahore history
          </button>
        </div>
      ) : (
        <>
          <div className="index-kpis">
            <article>
              <small>LATEST ASKING {purpose === "rent" ? "MONTHLY RENT" : "PRICE"}</small>
              <strong>{money(latest!.price, currency)}</strong>
              <span>
                {periodLabel(latest!.period)} · {primary.size}
              </span>
            </article>
            {previousMonth !== null && (
              <article>
                <small>ONE MONTH CHANGE</small>
                <strong className={(previousMonth ?? 0) < 0 ? "negative" : "positive"}>
                  {previousMonth === null ? "Unavailable" : `${previousMonth > 0 ? "+" : ""}${previousMonth.toFixed(1)}%`}
                </strong>
                <span>Against the exact previous month</span>
              </article>
            )}
            {annual !== null && (
              <article>
                <small>ONE YEAR CHANGE</small>
                <strong className={(annual ?? 0) < 0 ? "negative" : "positive"}>{annual === null ? "Unavailable" : `${annual > 0 ? "+" : ""}${annual.toFixed(1)}%`}</strong>
                <span>Against the same month last year</span>
              </article>
            )}
            <article>
              <small>OBSERVED HISTORY</small>
              <strong>{primary.points.length} points</strong>
              <span>
                {periodLabel(primary.points[0].period)} to {periodLabel(latest!.period)}
              </span>
            </article>
          </div>
          {primary.cadence === "sparse_reference" && (
            <p className="index-warning">
              <Info size={17} /> This source publishes current, six-month, one-year and two-year reference prices, not a complete monthly series. Historical dates are anchored to the current
              reporting month.
            </p>
          )}
          <div className="index-chart-card">
            <div className="chart-heading">
              <div>
                <h2>{primary.city}</h2>
                <p>
                  {segments[segment]} · {effectiveSize} · {purpose === "rent" ? "Monthly asking rent" : "Asking sale price"}
                </p>
              </div>
              <button className="secondary-button" onClick={exportHistory}>
                <Download size={16} /> Export history
              </button>
            </div>
            <div className="chart-options">
              <Pick title="Chart measure" value={metric} set={(s) => setMetric(s as Metric)} options={metricOptions} />
              <Pick title="Time range" value={range} set={setRange} options={timeRanges} />
              <Pick title="Display currency" value={currency} set={(s) => setCurrency(s as Currency)} options={Object.keys(data.fx.rates).map((c) => [c, c])} />
            </div>
            {Number(range) > availableMonths && <p className="chart-explainer">This selection has less than {timeRanges.find(([value]) => value === range)?.[1]} of recorded history. Showing all available observations.</p>}
            {metric === "sourceIndex" && selected.length > 1 ? (
              <p className="index-warning">
                <Info size={17} /> Published source indices may use different base periods. Choose the comparison index to compare performance.
              </p>
            ) : null}
            {metric === "rebased" && !chart.basePeriod ? (
              <div className="empty-state">
                <h3>No shared starting month</h3>
                <p>These histories do not have a common observation to use as a comparison baseline.</p>
              </div>
            ) : (
              <div className="large-chart">
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart key={`${segment}-${purpose}-${effectiveArea}-${effectiveSize}-${metric}-${range}-${currency}`} data={chart.rows} margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e5e4df" />
                    <XAxis dataKey="period" tickFormatter={periodLabel} tick={{ fontSize: 12, fill: "#666660" }} minTickGap={40} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={display} width={70} tick={{ fontSize: 12, fill: "#666660" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      labelFormatter={(p) => periodLabel(String(p))}
                      formatter={
                        ((value: number | null, name: string) => [
                          value === null ? "Unavailable" : metric === "rebased" || metric === "sourceIndex" ? Number(value).toFixed(2) : new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)),
                          String(name),
                        ]) as never
                      }
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e4df", fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                    {selected.map((s, i) => (
                      <Line
                        key={s.id}
                        name={`${s.city} · ${s.area} · ${s.size}`}
                        type="linear"
                        dataKey={s.id}
                        stroke={palette[i]}
                        strokeWidth={2.5}
                        strokeDasharray={["0", "8 4", "2 4"][i]}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        isAnimationActive
                        animationDuration={900}
                        animationBegin={60}
                        animationEasing="ease-out"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {!chart.rows.some((r) => selected.some((s) => r[s.id] !== null)) && <p className="index-warning">This measure is not published for the selected histories. Choose average asking price or the comparison index.</p>}
            <p className="chart-explainer">
              {metric === "rebased"
                ? `Each series equals 100 in ${chart.basePeriod ? periodLabel(chart.basePeriod) : "a shared month"}. Subsequent points show relative asking-price changes, not investment returns.`
                : metric === "sourceIndex"
                ? "Index values are reproduced from the source. Their original base periods are not assumed to be identical."
                : `Values shown in ${currency}${metric === "ppsf" ? " per square foot" : ""}${purpose === "rent" ? " per month" : ""}. Published observations are connected for visual continuity; missing monthly values are not estimated.`}{" "}
              {currency !== "PKR" ? "All points use the same dated FX snapshot, not historical exchange rates." : ""}
            </p>
            <div className="comparison-pickers">
              <Pick
                title="Compare with another market"
                value={compare[0] || "none"}
                set={(v) => setCompare([v, ...compare.slice(1)].filter((x) => x !== "none"))}
                options={[["none", "No comparison"], ...histories.filter((s) => s.id !== primary.id && s.purpose === purpose && s.segment === segment && s.size === effectiveSize && s.area === effectiveArea).map((s) => [s.id, `${s.city} · ${s.area}`] as [string, string])]}
              />
              <Pick
                title="Third market"
                value={compare[1] || "none"}
                set={(v) => setCompare([compare[0], v].filter((x) => x && x !== "none"))}
                options={[["none", "No comparison"], ...histories.filter((s) => s.id !== primary.id && s.id !== compare[0] && s.purpose === purpose && s.segment === segment && s.size === effectiveSize && s.area === effectiveArea).map((s) => [s.id, `${s.city} · ${s.area}`] as [string, string])]}
              />
              <button
                className="secondary-button"
                onClick={() => {
                  setCompare([]);
                  setMetric("price");
                }}
              >
                Reset comparison
              </button>
            </div>
          </div>
          <div className="index-lower">
            <section className="panel">
              <h2>Source observations</h2>
              <p>{primary.cadence === "sparse_reference" ? "Current and historical reference prices, with gaps left empty." : "Source values and calculated monthly price changes."}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Asking price</TableHead>
                    <TableHead>Per sq ft</TableHead>
                    <TableHead>Monthly change</TableHead>
                    <TableHead>Source index</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...visiblePoints].reverse().map((p) => {
                    const prev = primary.points.find((x) => monthNumber(x.period) === monthNumber(p.period) - 1);
                    const delta = prev ? (p.price / prev.price - 1) * 100 : null;
                    return (
                      <TableRow key={p.period}>
                        <TableCell>{periodLabel(p.period)}</TableCell>
                        <TableCell>{money(p.price, currency)}</TableCell>
                        <TableCell>{p.ppsf === null ? "Unavailable" : money(p.ppsf, currency)}</TableCell>
                        <TableCell>{delta === null ? "Unavailable" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`}</TableCell>
                        <TableCell>{p.sourceIndex ?? "Unavailable"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>
            <aside className="panel index-method">
              <div className="eyebrow">ABOUT THIS SERIES</div>
              <h3>Know what you are comparing</h3>
              <dl>
                <div>
                  <dt>City</dt>
                  <dd>{city}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{effectiveArea}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{effectiveSize}</dd>
                </div>
                <div>
                  <dt>Basis</dt>
                  <dd>Asking {purpose === "rent" ? "rent" : "sale price"}</dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd>{dateLabel(primary.retrievedAt)}</dd>
                </div>
                <div>
                  <dt>History</dt>
                  <dd>{primary.cadence === "sparse_reference" ? "Sparse reference points" : "Monthly source table"}</dd>
                </div>
                <div>
                  <dt>Sample count</dt>
                  <dd>Not published</dd>
                </div>
              </dl>
              <p>Changes may reflect the mix of advertised properties. These are not completed sales, valuations, actual rents received or a forecast.</p>
              <a className="primary-button" href={primary.url} target="_blank" rel="noreferrer">
                View source table <ArrowUpRight size={16} />
              </a>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
