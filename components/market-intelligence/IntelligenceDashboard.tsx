"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, Activity, Database, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { data, observations, cities, segments, money, periodLabel, dateLabel, type Currency } from "@/lib/marketIntelligence/insights";
import { histories, change } from "@/lib/marketIntelligence/indexEngine";

function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="picker">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, t]) => (
            <SelectItem value={v} key={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export default function IntelligenceDashboard() {
  const [city, setCity] = useState("Lahore");
  const [segment, setSegment] = useState("houses");
  const [purpose, setPurpose] = useState("buy");
  const [currency, setCurrency] = useState<Currency>("PKR");
  const matching = observations.filter((r) => r.city === city && r.segment === segment && r.purpose === purpose);
  const period = [...matching.map((r) => r.period)].sort().at(-1);
  const rows = matching.filter((r) => r.period === period);
  const values = rows.map((r) => r.price).sort((a, b) => a - b);
  const median = values.length
    ? values.length % 2
      ? values[Math.floor(values.length / 2)]
      : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    : null;
  const prices = [...rows]
    .filter((r) => r.ppsf !== null)
    .sort((a, b) => b.ppsf! - a.ppsf!)
    .slice(0, 10);
  const cityCoverage = cities.map((city) => ({ city, observations: observations.filter((r) => r.city === city).length }));
  const movers = histories
    .filter((s) => s.city === city && s.segment === segment && s.purpose === purpose && change(s, 12) !== null)
    .sort((a, b) => (change(b, 12) || 0) - (change(a, 12) || 0))
    .slice(0, 5);
  return (
    <div className="intelligence-dashboard">
      <div className="dashboard-top">
        <section className="dashboard-feature">
          <div className="eyebrow">A WIDER VIEW OF THE MARKET</div>
          <h2>Pakistan, area by area.</h2>
          <p>
            Explore current asking-price benchmarks alongside published monthly histories. Every view keeps its geography, property
            type and reporting period in focus.
          </p>
          <a href="/market-intelligence/index" className="primary-button">
            Open the Property Index <ArrowUpRight size={17} />
          </a>
        </section>
        <div className="dashboard-counts">
          <article>
            <MapPin size={19} />
            <strong>{new Set(observations.map((r) => r.city)).size}</strong>
            <span>Cities with area data</span>
          </article>
          <article>
            <Database size={19} />
            <strong>{observations.length}</strong>
            <span>Area snapshot observations</span>
          </article>
          <article>
            <Activity size={19} />
            <strong>{histories.reduce((n, s) => n + s.points.length, 0).toLocaleString()}</strong>
            <span>Historical price observations</span>
          </article>
        </div>
      </div>
      <div className="filters dashboard-filters">
        <Picker label="Dashboard city" value={city} onChange={setCity} options={cities.map((c) => [c, c])} />
        <Picker label="Dashboard property type" value={segment} onChange={setSegment} options={Object.entries(segments)} />
        <Picker
          label="Market"
          value={purpose}
          onChange={setPurpose}
          options={[
            ["buy", "For sale"],
            ["rent", "Monthly rent"],
          ]}
        />
        <Picker label="Dashboard currency" value={currency} onChange={(s) => setCurrency(s as Currency)} options={Object.keys(data.fx.rates).map((c) => [c, c])} />
      </div>
      <div className="section-heading dashboard-section-title">
        <div>
          <h2>
            {city} · {segments[segment]}
          </h2>
          <p>{period ? `${periodLabel(period)} · ${rows.length} area benchmarks with the same period` : "No verified snapshot for this market"}</p>
        </div>
        <a className="secondary-button" href={`/market-intelligence?view=explore&city=${encodeURIComponent(city)}&segment=${segment}&purpose=${purpose}`}>
          Explore areas <ArrowUpRight size={15} />
        </a>
      </div>
      {values.length ? (
        <>
          <div className="index-kpis">
            <article>
              <small>LOWEST AREA AVERAGE</small>
              <strong>{money(values[0], currency)}</strong>
              <span>{purpose === "rent" ? "Monthly asking rent" : "Asking price"}</span>
            </article>
            <article>
              <small>MEDIAN AREA AVERAGE</small>
              <strong>{money(median!, currency)}</strong>
              <span>Unweighted across included areas</span>
            </article>
            <article>
              <small>HIGHEST AREA AVERAGE</small>
              <strong>{money(values.at(-1)!, currency)}</strong>
              <span>Different property mixes apply</span>
            </article>
            <article>
              <small>OBSERVATION PERIOD</small>
              <strong>{periodLabel(period!)}</strong>
              <span>No mixed-period price summary</span>
            </article>
          </div>
          <div className="dashboard-charts">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Area price comparison</h2>
                  <p>Ten highest published asking prices per square foot within this selection.</p>
                </div>
              </div>
              <div className="area-bar-chart">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={prices.map((r) => ({ area: r.area, value: r.ppsf! / data.fx.rates[currency] }))} layout="vertical" margin={{ left: 5, right: 25 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 5" stroke="#e5e4df" />
                    <XAxis type="number" tickFormatter={(n) => new Intl.NumberFormat("en-GB", { notation: "compact" }).format(n)} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="area" width={160} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={((v: number) => [new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(v)), "Per sq ft"]) as never} />
                    <Bar dataKey="value" fill="#2a2a2a" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="footnote">An area-level comparison, not a ranking of investment quality or individual property values.</p>
              <details>
                <summary>Read chart values</summary>
                <ul className="chart-values">
                  {prices.map((r) => (
                    <li key={r.id}>
                      <span>{r.area}</span>
                      <strong>{money(r.ppsf!, currency)} / sq ft</strong>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Available annual changes</h2>
                  <p>Like-for-like series with an exact twelve-month comparison.</p>
                </div>
              </div>
              {movers.length ? (
                <div className="mover-list">
                  {movers.map((s) => (
                    <a key={s.id} href={`/market-intelligence/index?series=${s.id}`}>
                      <div>
                        <strong>{s.area}</strong>
                        <small>
                          {s.size} · {periodLabel(s.points.at(-1)!.period)}
                        </small>
                      </div>
                      <span className={(change(s, 12) || 0) < 0 ? "negative" : "positive"}>
                        {(change(s, 12) || 0) > 0 ? "+" : ""}
                        {change(s, 12)!.toFixed(1)}% <ArrowUpRight size={15} />
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">No matching annual history yet. Snapshot prices are not used to estimate growth.</div>
              )}
              <p className="footnote">Monthly histories are a separate collection. Dates and available areas can differ from the snapshot.</p>
              <a href="/market-intelligence/index" className="text-link">
                Explore all historical series <ArrowUpRight size={14} />
              </a>
            </section>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Database size={30} />
          <h2>Data unavailable for this selection</h2>
          <p>Choose another city or segment. Missing observations are never displayed as zero-priced properties.</p>
        </div>
      )}
      <div className="dashboard-bottom">
        <section className="panel">
          <h2>Coverage across Pakistan</h2>
          <p>Snapshot observation counts, not listing volumes or market share.</p>
          <div className="coverage-bars">
            {cityCoverage.map((c) => (
              <div key={c.city}>
                <span>{c.city}</span>
                <div>
                  <i style={{ width: `${(c.observations / Math.max(...cityCoverage.map((c) => c.observations))) * 100}%` }} />
                </div>
                <strong>{c.observations || "No data"}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel macro-panel">
          <div className="eyebrow">ECONOMIC CONTEXT</div>
          <h2>Keep the wider picture in view</h2>
          <div className="macro-row">
            <div>
              <small>National CPI, year on year</small>
              <strong>{data.context.nationalCpi.yoy}%</strong>
            </div>
            <span>{data.context.period}</span>
          </div>
          <div className="macro-row">
            <div>
              <small>Urban rent CPI, year on year</small>
              <strong>{data.context.urbanRent.yoy}%</strong>
            </div>
            <span>{data.context.period}</span>
          </div>
          <p>Consumer inflation and rental CPI are separate from asking property prices. They do not measure property returns.</p>
          <a className="text-link" href={data.context.sourceUrl} target="_blank" rel="noreferrer">
            PBS release <ArrowUpRight size={14} />
          </a>
          <div className="fx-mini">
            <h3>Currency snapshot</h3>
            <span>PKR per currency unit · {dateLabel(data.fx.asOf)}</span>
            <div>
              {Object.entries(data.fx.rates)
                .filter(([c]) => c !== "PKR")
                .map(([c, v]) => (
                  <p key={c}>
                    <span>{c}</span>
                    <strong>{v.toFixed(4)}</strong>
                  </p>
                ))}
            </div>
            <a className="text-link" href={data.fx.url} target="_blank" rel="noreferrer">
              SBP release <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </div>
      <div className="coverage-note">
        <h3>What this intelligence can tell you</h3>
        <p>
          Compare published asking levels, inspect historical movement and understand where evidence exists. It does not establish
          completed transaction prices, listing demand, rental yields or future returns. Collection is partial, and unavailable source
          pages are recorded rather than estimated.
        </p>
      </div>
    </div>
  );
}
