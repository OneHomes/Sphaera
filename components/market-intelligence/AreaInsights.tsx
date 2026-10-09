"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Bell, Check, ChevronRight, ChevronUp, ChevronDown, ArrowDownUp, Download, Grid2X2, MapPin, Search, X, Activity, Database, Globe2, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import IndexExplorer from "./IndexExplorer";
import { histories, monthNumber } from "@/lib/marketIntelligence/indexEngine";
import IntelligenceDashboard from "./IntelligenceDashboard";
import ForecastDashboard from "./ForecastDashboard";
import CoverageMap from "./CoverageMap";
import { data, observations, cities, segments, queryRows, money, dateLabel, periodLabel, coverage, parseFilters, type Currency, type Observation } from "@/lib/marketIntelligence/insights";

import "@/app/market-intelligence/insights.css";

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (s: string) => void; options: [string, string][] }) {
  return (
    <label className="picker">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
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
function SortHead({ label, column, sort, onSort }: { label: string; column: "name" | "price" | "ppsf" | "period"; sort: string; onSort: (column: string) => void }) {
  const active = sort === column || sort === `${column}-asc` || sort === `${column}-desc`;
  const descending = sort === `${column}-desc`;
  const Icon = !active ? ArrowDownUp : descending ? ChevronDown : ChevronUp;
  return (
    <TableHead aria-sort={active ? (descending ? "descending" : "ascending") : "none"}>
      <button className="sort-head" onClick={() => onSort(column)}>
        {label}
        <Icon size={14} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
export default function AreaInsights({ initialTab = "dashboard" }: { initialTab?: string }) {
  const [city, setCity] = useState("Lahore");
  const [segment, setSegment] = useState("houses");
  const [purpose, setPurpose] = useState("buy");
  const [currency, setCurrency] = useState<Currency>("PKR");
  const [unit, setUnit] = useState("sqft");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const toggleSort = (column: string) => setSort((current) => (current === column || current === `${column}-asc` ? `${column}-desc` : `${column}-asc`));
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [events, setEvents] = useState(data.updates);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [mapCity, setMapCity] = useState("Lahore");
  const [mapSegment, setMapSegment] = useState("all");
  const [mapSelected, setMapSelected] = useState<string | null>(null);
  const mapPoints = useMemo(() => {
    const latest = new Map<string, Observation>();
    for (const r of observations.filter((r) => r.city === mapCity && r.purpose === "buy" && (mapSegment === "all" || r.segment === mapSegment))) {
      const key = `${r.area}:${r.segment}`;
      const previous = latest.get(key);
      if (!previous || r.period > previous.period) latest.set(key, r);
    }
    return [...latest.values()].sort((a, b) => a.area.localeCompare(b.area));
  }, [mapCity, mapSegment]);
  const mapSegmentOptions: [string, string][] = [
    ["all", "All segments"],
    ...Object.entries(segments).filter(([s]) => ["houses", "flats", "residential_plots", "commercial_plots"].includes(s) && mapPoints.some((r) => r.segment === s)).map(([s, t]) => [s, t] as [string, string]),
  ];
  const rows = useMemo(() => queryRows({ city, segment, purpose, q, sort }), [city, segment, purpose, q, sort]);
  const comparison = observations.filter((r) => selectedRows.includes(r.id));
  const unread = events.filter((n) => !seen.includes(n.id));
  const marketMovers = useMemo(
    () =>
      histories
        .map((series) => {
          const latest = series.points.at(-1);
          if (!latest) return null;
          const previous = series.points.find((point) => monthNumber(point.period) === monthNumber(latest.period) - 1);
          if (!previous) return null;
          const change = (latest.price / previous.price - 1) * 100;
          return { ...series, latest, change };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && Number.isFinite(item.change))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 6),
    []
  );
  const unitFactor = unit === "sqm" ? 10.76391041671 : unit === "sqyd" ? 9 : 1;
  const unitName = unit === "sqm" ? "m²" : unit === "sqyd" ? "sq yd" : "sq ft";
  useEffect(() => {
    setPage(1);
  }, [city, segment, purpose, q, sort]);
  useEffect(() => {
    try {
      const f = parseFilters(new URLSearchParams(location.search));
      if (location.search) {
        const view = new URLSearchParams(location.search).get("view");
        if (view && ["dashboard", "explore", "coverage", "sources"].includes(view)) setTab(view);
        setCity(f.city || "Lahore");
        setSegment(f.segment || "houses");
        setPurpose(f.purpose || "buy");
        setQ(f.q || "");
      }
      const s = JSON.parse(localStorage.getItem("sphaera-insights-seen") || "[]");
      if (Array.isArray(s)) setSeen(s.filter((x) => typeof x === "string"));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || tab !== "explore") return;
    const p = new URLSearchParams({ city, segment, purpose, view: "explore" });
    if (q) p.set("q", q);
    history.replaceState(null, "", "/market-intelligence?" + p.toString());
  }, [city, segment, purpose, q, ready, tab]);
  useEffect(() => {
    if (!ready) return;
    for (const n of events) {
      if (seen.includes(n.id)) continue;
      toast(n.title, { id: n.id, description: n.body, duration: 9000, onDismiss: () => markRead([n.id]), action: { label: "View updates", onClick: () => setNoticeOpen(true) } });
    }
  }, [ready, events]);
  useEffect(() => {
    const refresh = async () => {
      try {
        const r = await fetch("/api/market-intelligence/v1/updates", { cache: "no-store" });
        if (!r.ok) return;
        const x = (await r.json()) as { version: string; updates: typeof data.updates };
        if (Array.isArray(x.updates) && x.version !== data.version) {
          setEvents((current) => (JSON.stringify(current) === JSON.stringify(x.updates) ? current : x.updates));
          toast("New market data is available", { id: "refresh-data", duration: Infinity, action: { label: "Refresh", onClick: () => location.reload() } });
        }
      } catch {}
    };
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, []);
  function markRead(ids: string[]) {
    const next = [...new Set([...seen, ...ids])];
    setSeen(next);
    try {
      localStorage.setItem("sphaera-insights-seen", JSON.stringify(next));
    } catch {}
    ids.forEach((id) => toast.dismiss(id));
  }
  function toggle(r: Observation) {
    if (selectedRows.includes(r.id)) setSelectedRows(selectedRows.filter((x) => x !== r.id));
    else if (selectedRows.length < 3) setSelectedRows([...selectedRows, r.id]);
    else toast("Compare up to three areas at once");
  }
  function exportRows() {
    const fields = ["city", "area", "segment", "purpose", "price", "ppsf", "period", "retrievedAt", "sourceUrl", "basis"];
    const csv = [fields, ...rows.map((r) => fields.map((f) => String(r[f as keyof Observation] ?? "")))].map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sphaera-market-intelligence.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const pricePer = (r: Observation) => (r.ppsf === null ? "Unavailable" : money(r.ppsf * unitFactor, currency));
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const periods = [...new Set(rows.map((r) => r.period))].sort();
  return (
    <div className="insights-app">
      <header className="topbar">
        <a href="/market-intelligence" className="brand">
          <img src="/brand/sphaera-wordmark-black.svg" alt="Sphaera" height="24" />
          <span className="brand-product">Market Intelligence</span>
        </a>
        <div className="header-right">
          <span className="private-badge">
            <span />
            Private workspace
          </span>
          <button className="icon-button notification-bell" onClick={() => setNoticeOpen(true)} aria-label={`Notifications, ${unread.length} unread`}>
            <Bell size={21} />
            {unread.length > 0 && <b>{unread.length}</b>}
          </button>
        </div>
      </header>
      <main>
        <div className="page-intro">
          <div>
            <div className="eyebrow">PAKISTAN / PROPERTY INTELLIGENCE</div>
            <h1>
              Market Intelligence<span className="heading-period">.</span>
            </h1>
            <p>Area benchmarks, monthly indices and the economic context behind them.</p>
          </div>
          <div className="snapshot-label">
            <span className="status-dot" /> Published snapshot
            <small>Retrieved {dateLabel(data.retrievedAt)}</small>
          </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            if (v !== "explore") history.replaceState(null, "", v === "dashboard" ? "/market-intelligence" : "/market-intelligence?view=" + v);
          }}
        >
          <div className="tabbar">
            <TabsList>
              <TabsTrigger value="dashboard">
                <Activity size={16} /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="explore">
                <Grid2X2 size={16} /> Explore areas
              </TabsTrigger>
              <a className={tab === "index" ? "index-nav active" : "index-nav"} href="/market-intelligence/index">
                <Activity size={16} /> Property Index
              </a>
              <a className={tab === "forecast" ? "index-nav active" : "index-nav"} href="/market-intelligence/forecast">
                <Activity size={16} /> Forecast
              </a>
              <TabsTrigger value="coverage">
                <Globe2 size={16} /> Coverage
              </TabsTrigger>
              <TabsTrigger value="sources">
                <Database size={16} /> Sources & method
              </TabsTrigger>
            </TabsList>
            <span>
              {observations.length.toLocaleString()} observations · {cities.length} established cities
            </span>
          </div>
          <TabsContent value="explore">
            <div className="filters">
              <Picker label="City" value={city} onChange={setCity} options={cities.map((c) => [c, c])} />
              <Picker label="Property segment" value={segment} onChange={setSegment} options={Object.entries(segments)} />
              <Picker
                label="Purpose"
                value={purpose}
                onChange={setPurpose}
                options={[
                  ["buy", "For sale"],
                  ["rent", "To rent"],
                ]}
              />
              <Picker label="Currency" value={currency} onChange={(s) => setCurrency(s as Currency)} options={Object.keys(data.fx.rates).map((c) => [c, c])} />
              <Picker
                label="Price unit"
                value={unit}
                onChange={setUnit}
                options={[
                  ["sqft", "Per sq ft"],
                  ["sqm", "Per sq m"],
                  ["sqyd", "Per sq yd"],
                ]}
              />
            </div>
            <div className="summary-strip">
              <div>
                <small>YOUR MARKET</small>
                <strong>{city === "all" ? "All cities" : city}</strong>
                <span>
                  {segments[segment] || "All segments"} · {purpose === "buy" ? "Asking sale prices" : "Asking monthly rents"}
                </span>
              </div>
              <div>
                <small>AREA OBSERVATIONS</small>
                <strong>{rows.length}</strong>
                <span>Published benchmarks, not listing counts</span>
              </div>
              <div>
                <small>REPORTING PERIOD</small>
                <strong>{periods.length === 1 ? periodLabel(periods[0]) : periods.length ? `${periodLabel(periods[0])} onwards` : "Awaiting data"}</strong>
                <span>Dates follow the source observation</span>
              </div>
              <div className="summary-note">
                <Info size={18} />
                <p>Asking prices show seller expectations. They are not completed transaction prices or a property valuation.</p>
              </div>
            </div>
            <div className="results-heading">
              <div>
                <h2>
                  Explore neighbourhoods <span>{rows.length}</span>
                </h2>
                <p>Click a column heading to sort, then click again to reverse the order.</p>
              </div>
              <div className="result-actions">
                <label className="search">
                  <Search size={17} />
                  <input aria-label="Search neighbourhood" placeholder="Find a neighbourhood" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <button className="secondary-button" onClick={exportRows} disabled={!rows.length}>
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>
            {rows.length ? (
              <div className="table-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="check-cell">Compare</TableHead>
                      <SortHead label="NEIGHBOURHOOD" column="name" sort={sort} onSort={toggleSort} />
                      <SortHead label={`AVERAGE ASKING ${purpose === "rent" ? "RENT / MONTH" : "PRICE"}`} column="price" sort={sort} onSort={toggleSort} />
                      <SortHead label={`PRICE / ${unitName.toUpperCase()}`} column="ppsf" sort={sort} onSort={toggleSort} />
                      <SortHead label="PERIOD" column="period" sort={sort} onSort={toggleSort} />
                      <TableHead>
                        <span className="sr-only">Details</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice((page - 1) * 20, page * 20).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox aria-label={`Compare ${r.area}`} checked={selectedRows.includes(r.id)} onCheckedChange={() => toggle(r)} />
                        </TableCell>
                        <TableCell>
                          <button className="area-name" onClick={() => setDetail(r)}>
                            <span className="area-icon">
                              <MapPin size={17} />
                            </span>
                            <span>
                              {r.area}
                              <small>
                                {r.city} · {segments[r.segment]}
                              </small>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="number">{money(r.price, currency)}</TableCell>
                        <TableCell className="number muted">{pricePer(r)}</TableCell>
                        <TableCell>{periodLabel(r.period)}</TableCell>
                        <TableCell>
                          <button className="icon-button" onClick={() => setDetail(r)} aria-label={`Details for ${r.area}`}>
                            <ArrowUpRight size={19} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="table-footer">
                  <span>
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, rows.length)} of {rows.length}
                  </span>
                  <div>
                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </button>
                    <span>
                      {page} / {pages}
                    </span>
                    <button disabled={page === pages} onClick={() => setPage(page + 1)}>
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Database size={32} />
                <h2>{q ? "No matching neighbourhoods" : "No verified observations yet"}</h2>
                <p>
                  {q
                    ? "Try another area name."
                    : `We have not imported usable ${purpose === "rent" ? "rental" : "sale"} benchmarks for ${(segments[segment] || "this segment").toLowerCase()} in ${city}. Missing data is not a zero price.`}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => (q ? setQ("") : setTab("coverage"))}
                >
                  {q ? "Clear search" : "Review coverage"}
                </button>
              </div>
            )}
            {comparison.length > 0 && (
              <section className="comparison">
                <div className="section-heading">
                  <h2>Area comparison</h2>
                  <button onClick={() => setSelectedRows([])}>Clear selection</button>
                </div>
                <p>Compare the same segment, purpose and period. Area averages can reflect different property sizes and mixes.</p>
                <div className="compare-grid">
                  {comparison.map((r) => (
                    <article key={r.id}>
                      <button className="remove" onClick={() => toggle(r)} aria-label={`Remove ${r.area}`}>
                        <X size={17} />
                      </button>
                      <small>
                        {r.city} · {segments[r.segment]} · {r.purpose === "rent" ? "Rent" : "Sale"}
                      </small>
                      <h3>{r.area}</h3>
                      <strong>{money(r.price, currency)}</strong>
                      <p>
                        {pricePer(r)} / {unitName}
                      </p>
                      <span>{periodLabel(r.period)}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>
          <TabsContent value="dashboard">
            <IntelligenceDashboard />
          </TabsContent>
          <TabsContent value="index">
            <IndexExplorer />
          </TabsContent>
          <TabsContent value="forecast">
            <ForecastDashboard />
          </TabsContent>
          <TabsContent value="coverage">
            <section className="panel coverage-panel">
              <div className="section-heading">
                <div>
                  <h2>City coverage map</h2>
                  <p>Hover over a marker to see a verified area benchmark. Select it to open the published source record.</p>
                </div>
                <span className="pill">{mapPoints.length} mapped areas</span>
              </div>
              <div className="coverage-map-toolbar">
                <Picker
                  label="City"
                  value={mapCity}
                  onChange={(v) => {
                    setMapCity(v);
                    setMapSelected(null);
                  }}
                  options={cities.map((c) => [c, c])}
                />
                <Picker
                  label="Segment"
                  value={mapSegment}
                  onChange={(v) => {
                    setMapSegment(v);
                    setMapSelected(null);
                  }}
                  options={mapSegmentOptions}
                />
              </div>
              <CoverageMap city={mapCity} points={mapPoints} segments={segments} currency={currency} selectedId={mapSelected} onHover={setMapSelected} onSelect={setDetail} />
              <div className="map-legend">
                <span>
                  <i className="legend-dot" /> Verified asking benchmark
                </span>
                <span>Carto light basemap using OpenStreetMap data · markers recalculate with zoom and pan; exact source geocodes are not published</span>
              </div>
              {detail && detail.city === mapCity && (
                <div className="map-selection">
                  <div>
                    <span className="eyebrow">SELECTED AREA</span>
                    <h3>{detail.area}</h3>
                    <p>
                      {segments[detail.segment]} · {periodLabel(detail.period)} · {money(detail.price, currency)}
                    </p>
                  </div>
                  <button className="secondary-button" onClick={() => setDetail(detail)}>
                    Open details <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              <div className="table-card coverage-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CITY</TableHead>
                      {Object.entries(segments)
                        .filter(([s]) => observations.some((r) => r.segment === s))
                        .map(([s, t]) => (
                          <TableHead key={s}>{t}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverage().map((c) => (
                      <TableRow key={c.city}>
                        <TableCell>
                          <strong>{c.city}</strong>
                        </TableCell>
                        {c.segments
                          .filter((s) => observations.some((r) => r.segment === s.segment))
                          .map((s) => (
                            <TableCell key={s.segment}>
                              <button
                                onClick={() => {
                                  setCity(c.city);
                                  setSegment(s.segment);
                                  setPurpose(s.sale ? "buy" : "rent");
                                  setTab("explore");
                                }}
                                className={s.sale || s.rent ? "coverage-count" : "muted"}
                              >
                                {s.sale ? `${s.sale} sale` : "Not verified"}
                                {s.rent > 0 && <small> · {s.rent} rent</small>}
                              </button>
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="coverage-note">
                <h3>Coverage boundaries</h3>
                <p>Markers show verified area benchmarks, not every advertised project. This is a partial public-index collection, not a complete copy of Zameen listings.</p>
                <p>Direct automated retrieval returned HTTP 403 during this build. Accessible public index observations were reviewed through research access. Bulk collection is not running.</p>
                <div className="history-coverage">
                  <h3>Historical index coverage</h3>
                  <p>
                    {histories.length} histories, {histories.reduce((n, s) => n + s.points.length, 0).toLocaleString()} price observations across {new Set(histories.map((s) => s.city)).size} cities.
                    Monthly tables and sparse historical reference points are labelled separately.
                  </p>
                  <a className="text-link" href="/market-intelligence/index">
                    Explore index graphs <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="sources">
            <section className="panel methodology">
              <h2>Clear provenance. Useful context.</h2>
              <p>Sphaera Market Intelligence is an independent research module. Published source observations remain attributed and are never represented as Sphaera transactions.</p>
              <div className="method-grid">
                <article>
                  <h3>Property benchmarks</h3>
                  <p>Zameen Index supplies published average asking-price observations. Rounded values are retained at their published precision. Underlying sample counts are unavailable. Average prices reflect the property mix within an area.</p>
                  <p>Each record carries its city, segment, purpose, reporting period, retrieval date and source URL. No missing months are interpolated.</p>
                  <a href="https://www.zameen.com/index/" target="_blank" rel="noreferrer">
                    Zameen Index <ArrowUpRight size={14} />
                  </a>
                </article>
                <article>
                  <h3>Currency conversions</h3>
                  <p>SBP weighted average customer selling rates, PKR per unit of foreign currency, dated {dateLabel(data.fx.asOf)}.</p>
                  <dl>
                    {Object.entries(data.fx.rates)
                      .filter(([c]) => c !== "PKR")
                      .map(([c, r]) => (
                        <div key={c}>
                          <dt>{c}</dt>
                          <dd>{r.toFixed(4)}</dd>
                        </div>
                      ))}
                  </dl>
                  <a href={data.fx.url} target="_blank" rel="noreferrer">
                    Read SBP publication <ArrowUpRight size={14} />
                  </a>
                </article>
                <article>
                  <h3>Housing & inflation</h3>
                  <p>
                    PBS {data.context.period}, base {data.context.base}. CPI measures consumer-price change, not property sale prices or rental yields.
                  </p>
                  <dl>
                    <div>
                      <dt>National CPI, annual</dt>
                      <dd>{data.context.nationalCpi.yoy}%</dd>
                    </div>
                    <div>
                      <dt>Housing group, annual</dt>
                      <dd>{data.context.housingGroup.yoy}%</dd>
                    </div>
                    <div>
                      <dt>Urban rent, annual</dt>
                      <dd>{data.context.urbanRent.yoy}%</dd>
                    </div>
                    <div>
                      <dt>Rural rent, annual</dt>
                      <dd>{data.context.ruralRent.yoy}%</dd>
                    </div>
                  </dl>
                  <a href={data.context.sourceUrl} target="_blank" rel="noreferrer">
                    Read PBS publication <ArrowUpRight size={14} />
                  </a>
                </article>
              </div>
              <h3>Historical graphs</h3>
              <p>
                Monthly table values and sparse historical reference prices are kept separate. Relative labels such as &ldquo;one year ago&rdquo; are anchored to the source&rsquo;s explicit current
                reporting month. Missing months remain empty. A comparison index rebases each selected series to 100 at the first shared month in the chosen window. Published source indices retain
                their original values, and their original base periods are not assumed to match. Non-PKR historical charts use the current dated SBP snapshot, not historical exchange rates.
              </p>
              <h3>Collection & reuse</h3>
              <p>
                Coverage is limited to imported observations. No licensed bulk feed, source partnership or complete national coverage is claimed. Collection must respect source access controls and
                applicable reuse rights. The collector stops on blocked or rate-limited requests and preserves the previous snapshot. Listing photographs, descriptions, contacts and personal data are
                not included.
              </p>
              <p>Rental asking prices, evidence-backed tenancies, completed sales, tax valuations and CPI remain separate datasets. There are no verified rental-yield or completed-sale estimates in this release.</p>
              <details>
                <summary>Observation source register</summary>
                <ul className="source-list">
                  {Array.from(new Set([...observations.map((r) => r.sourceUrl), ...histories.map((s) => s.url)])).map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url.replace("https://www.zameen.com/index/", "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <a href="/api/market-intelligence/v1/coverage" target="_blank">
                Machine-readable coverage <ArrowUpRight size={14} />
              </a>
            </section>
          </TabsContent>
        </Tabs>
        <footer>
          <span>
            SPHAERA <span className="muted">/ Market Intelligence</span>
          </span>
          <button onClick={() => setTab("sources")}>
            Sources & methodology <ChevronRight size={14} />
          </button>
          <span className="muted">Data version {data.version}</span>
        </footer>
      </main>
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>{detail?.area}</SheetTitle>
            <SheetDescription>
              {detail?.city} · {detail && segments[detail.segment]}
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="detail-body">
              <span className="eyebrow">PUBLISHED ASKING {detail.purpose === "buy" ? "PRICE" : "MONTHLY RENT"}</span>
              <h2>{money(detail.price, currency)}</h2>
              <dl>
                <div>
                  <dt>Per {unitName}</dt>
                  <dd>{pricePer(detail)}</dd>
                </div>
                <div>
                  <dt>Reporting period</dt>
                  <dd>{periodLabel(detail.period)}</dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd>{dateLabel(detail.retrievedAt)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{detail.source}</dd>
                </div>
                <div>
                  <dt>Sample count</dt>
                  <dd>Not published</dd>
                </div>
              </dl>
              <p>Published averages are indicative and depend on the size and mix of advertised properties. They do not confirm an individual property&rsquo;s value or a completed transaction.</p>
              <a className="primary-button" href={detail.sourceUrl} target="_blank" rel="noreferrer">
                Open source <ArrowUpRight size={16} />
              </a>
              <button className="secondary-button" onClick={() => toggle(detail)}>
                {selectedRows.includes(detail.id) ? "Remove from comparison" : "Add to comparison"}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={noticeOpen} onOpenChange={setNoticeOpen}>
        <SheetContent className="notification-centre">
          <SheetHeader>
            <SheetTitle>Notification Centre</SheetTitle>
            <SheetDescription>Published market and platform updates</SheetDescription>
          </SheetHeader>
          <div className="notification-toolbar">
            <span>{unread.length} unread</span>
            <button onClick={() => markRead(events.map((n) => n.id))}>
              <Check size={15} /> Mark all read
            </button>
          </div>
          {marketMovers.length > 0 && (
            <section className="market-movers" aria-label="Price movements">
              <div className="notification-section-heading">
                <span>MARKET MOVERS</span>
                <small>Exact month-on-month changes</small>
              </div>
              <div className="market-mover-list">
                {marketMovers.map((mover) => {
                  const rising = mover.change > 0;
                  const falling = mover.change < 0;
                  return (
                    <a className={`market-mover ${rising ? "up" : falling ? "down" : "flat"}`} key={mover.id} href="/market-intelligence/index" onClick={() => setNoticeOpen(false)}>
                      <span className="market-mover-icon" aria-hidden="true">
                        {rising ? <ArrowUpRight size={17} /> : falling ? <ArrowDownRight size={17} /> : <Minus size={17} />}
                      </span>
                      <span className="market-mover-copy">
                        <strong>{mover.area}</strong>
                        <small>
                          {mover.city} · {mover.segment === "flats" ? "Apartments" : segments[mover.segment]} · {periodLabel(mover.latest.period)}
                        </small>
                      </span>
                      <span className="market-mover-change">
                        {rising ? "+" : ""}
                        {mover.change.toFixed(1)}%
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}
          <div className="notification-list">
            {events.map((n) => (
              <article className={`notification-card ${seen.includes(n.id) ? "read" : ""}`} key={n.id}>
                <div className="notification-meta">
                  <img className="mini-mark" src="/brand/icon.svg" alt="" width="22" height="22" />
                  <span>
                    SPHAERA · {n.category}
                  </span>
                  <button aria-label={`Dismiss ${n.title}`} onClick={() => markRead([n.id])}>
                    <X size={15} />
                  </button>
                </div>
                <h3>
                  {n.title}
                  {!seen.includes(n.id) && <span className="status-dot" />}
                </h3>
                <p>{n.body}</p>
                <div className="notification-bottom">
                  <time>{dateLabel(n.publishedAt)}</time>
                  <a href={n.url} target="_blank" rel="noreferrer" onClick={() => markRead([n.id])}>
                    Read source <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="notification-footnote">Read status is saved on this device. Updates are checked every minute while this window is open.</p>
        </SheetContent>
      </Sheet>
      <Toaster theme="light" position="top-right" closeButton richColors toastOptions={{ className: "sphaera-toast" }} />
    </div>
  );
}
