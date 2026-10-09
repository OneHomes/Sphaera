"use client";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { forecastCities, forecastConfig, projectCityMarket, type ForecastRates } from "@/lib/marketIntelligence/forecastEngine";
import { dateLabel, money } from "@/lib/marketIntelligence/insights";

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const labels: { id: keyof ForecastRates; label: string }[] = [
  { id: "downside", label: "Lower growth" },
  { id: "reference", label: "Expected path" },
  { id: "upside", label: "Higher growth" },
];
export default function ForecastDashboard() {
  const [city, setCity] = useState("Lahore");
  const [selectedScenario, setSelectedScenario] = useState<keyof ForecastRates>("reference");
  const projection = projectCityMarket(city);
  const { evidence, rows } = projection;
  const chart = rows.map((r) => ({ year: r.year, downside: r.downsidePpsf, reference: r.referencePpsf, upside: r.upsidePpsf }));
  const selected = labels.find((s) => s.id === selectedScenario)!;
  function exportProjection() {
    const lines = [
      ["City", "Year", "Scenario", "Observed annual change basis %", "Projected PKR per sq ft", "Cumulative change %", "Historical series used", "Model date"],
      ...rows.flatMap((r) =>
        labels.map((s) => [
          city,
          r.year,
          s.label,
          evidence.observedAnnualChange.toFixed(4),
          (r[`${s.id}Ppsf` as keyof typeof r] ?? "").toString(),
          r[`${s.id}Ppsf` as keyof typeof r] === null || evidence.baselinePpsf === null ? "" : (Number(r[`${s.id}Ppsf` as keyof typeof r]) - evidence.baselinePpsf).toFixed(4),
          evidence.seriesCount,
          forecastConfig.asOf,
        ])
      ),
    ];
    const csv = lines.map((row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sphaera-${city}-price-forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="forecast-workbench">
      <div className="section-heading">
        <div>
          <div className="eyebrow">FIVE-YEAR MARKET OUTLOOK</div>
          <h2>What could prices do next?</h2>
          <p>This page shows how much one square foot could cost from 2026 to 2031 if the city&rsquo;s observed pattern continues.</p>
        </div>
        <span className="pill">Scenario, not a promise</span>
      </div>
      <div className="forecast-city-picker">
        <label>
          <span>City</span>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger aria-label="Forecast city">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {forecastCities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div>
          <small>Evidence base</small>
          <strong>{evidence.seriesCount} historical series</strong>
          <span>{evidence.annualCount ? `${evidence.annualCount} exact 12-month changes` : "Full-period changes used"}</span>
        </div>
      </div>
      <div className="forecast-evidence-strip">
        <article>
          <small>PAST CITY MOVEMENT</small>
          <strong>{pct(evidence.observedAnnualChange)}</strong>
          <span>Typical yearly change in {city}</span>
        </article>
        <article>
          <small>PRICE TODAY</small>
          <strong>{evidence.baselinePpsf ? money(evidence.baselinePpsf, "PKR") : "Unavailable"}</strong>
          <span>Latest observed price per sq ft</span>
        </article>
        <article>
          <small>POSSIBLE 2031 PRICE</small>
          <strong className="forecast-positive">&uarr; {endValue(rows, selectedScenario)}</strong>
          <span>{selected.label}</span>
        </article>
        <article>
          <small>BUILDING COST PRESSURE</small>
          <strong className="forecast-positive">&uarr; {forecastConfig.constructionPressure.value.toFixed(2)}%</strong>
          <span>Separate PBS construction signal</span>
        </article>
      </div>
      <div className="forecast-how">
        <strong>How to read this</strong>
        <span>1. Pick a city.</span>
        <span>2. Choose a path below.</span>
        <span>3. Read the possible price in 2031.</span>
      </div>
      <div className="forecast-scenarios" aria-label="Data-derived scenarios">
        {labels.map((s) => (
          <button key={s.id} className={selectedScenario === s.id ? "active" : ""} onClick={() => setSelectedScenario(s.id)}>
            <span className="trajectory-mark">&uarr;</span>
            <strong>{s.label}</strong>
            <small>{pct(evidence.rates[s.id])} yearly change</small>
            <em>Based on this city&rsquo;s recorded prices</em>
          </button>
        ))}
      </div>
      <div className="forecast-main single">
        <section className="index-chart-card forecast-chart">
          <div className="chart-heading">
            <div>
              <h2>{city} price trajectory</h2>
              <p>Projected PKR per sq ft, based on the latest city benchmark</p>
            </div>
            <button className="secondary-button" onClick={exportProjection}>
              <Download size={16} /> Export
            </button>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chart} margin={{ top: 22, right: 20, left: 0, bottom: 12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#e5e4df" />
              <XAxis dataKey="year" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <ReferenceLine y={evidence.baselinePpsf ?? 0} stroke="#b1b1b1" />
              <Tooltip labelFormatter={(y) => `${y} · ${city}`} formatter={((value: number, name: string) => [Number(value).toFixed(2), labels.find((s) => s.id === name)?.label || name]) as never} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 15 }} />
              {labels.map((s) => (
                <Line
                  key={s.id}
                  name={s.label}
                  dataKey={s.id}
                  stroke={s.id === selectedScenario ? "#124b2d" : "#75ad86"}
                  strokeOpacity={s.id === selectedScenario ? 1 : 0.6}
                  strokeWidth={s.id === selectedScenario ? 3.5 : 2.2}
                  dot={{ r: s.id === selectedScenario ? 4 : 2 }}
                  type="linear"
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-explainer">
            The projection compounds the selected city&rsquo;s observed price-per-square-foot change. Construction input pressure is shown separately and is not automatically passed through to sale
            prices.
          </p>
        </section>
      </div>
      <section className="panel forecast-table">
        <h2>Year-by-year {city} outlook</h2>
        <p>Every value is calculated from the selected city&rsquo;s observed historical change distribution.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              {labels.map((s) => (
                <TableHead key={s.id}>{s.label}</TableHead>
              ))}
              <TableHead>Selected trajectory</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.year}>
                <TableCell>{r.year}</TableCell>
                {labels.map((s) => (
                  <TableCell key={s.id}>{r[`${s.id}Ppsf` as keyof typeof r] === null ? "Unavailable" : money(Number(r[`${s.id}Ppsf` as keyof typeof r]), "PKR")}</TableCell>
                ))}
                <TableCell className="forecast-positive">&uarr; {r[`${selectedScenario}Ppsf` as keyof typeof r] === null ? "Unavailable" : money(Number(r[`${selectedScenario}Ppsf` as keyof typeof r]), "PKR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="forecast-bottom">
        <section className="panel">
          <h2>In plain English</h2>
          <ul className="forecast-method">
            <li>We start with the latest verified asking price for the city.</li>
            <li>We look at how that city&rsquo;s published prices changed in the past.</li>
            <li>We apply a lower, expected or higher yearly path to show a possible 2031 price.</li>
            <li>Higher construction costs are shown as pressure that can push prices up, but they are not added one-for-one.</li>
            <li>This is an evidence-based scenario, not a guarantee and not a completed-sales valuation.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>What is included?</h2>
          <p>
            Construction input items rose {forecastConfig.constructionPressure.value.toFixed(2)}% year on year in the PBS {forecastConfig.constructionPressure.period} release. Population growth and
            new supply are not numerically added until verified city-level series are available.
          </p>
          <a className="text-link" href={forecastConfig.constructionPressure.sourceUrl} target="_blank" rel="noreferrer">
            Read the PBS construction release
          </a>
          <p className="footnote">Model prepared {dateLabel(forecastConfig.asOf)}.</p>
        </section>
      </div>
    </section>
  );
}
function endValue(rows: Array<Record<string, number | string | null>>, key: keyof ForecastRates) {
  const end = rows.at(-1);
  const value = end?.[`${key}Ppsf`];
  return value === null || value === undefined ? "Unavailable" : money(Number(value), "PKR");
}
