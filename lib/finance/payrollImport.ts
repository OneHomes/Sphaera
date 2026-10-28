import ExcelJS from "exceljs";

// People Costs payroll-master import (Sphaera People Costs skill). HR master figures are reference
// records for reconciliation only — they are never posted to the ledger as expenses.

export type PayrollLine = {
  csvRow: number;
  employeeName: string;
  sourceDepartment: string | null;
  approvedDepartment: string | null;
  subDepartment: string | null;
  designation: string | null;
  company: string | null;
  dateJoined: string | null; // YYYY-MM-DD
  employmentType: string | null;
  employmentStatus: string | null;
  currency: "USD" | "PKR";
  baseSalary: number;
  transportAllowance: number;
  bookingsCommission: number;
  dealClosedCommission: number;
  sourcePayable: number;
  sourceComments: string | null;
  reviewNote: string | null;
};

export type SourceTotal = { csvRow: number; label: string; usd: number | null; pkr: number | null };

export type PayrollException = {
  csvRow: number | null;
  subject: string;
  issue: string;
  currency: string | null;
  components: number | null;
  sourcePayable: number | null;
  variance: number | null;
  evidence: string | null;
};

export type PayrollParse = {
  sourceName: string;
  payPeriod: string | null;
  fxPkrPerUsd: number;
  fxFromSource: boolean;
  lines: PayrollLine[];
  sourceTotals: SourceTotal[];
  departments: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const componentSum = (l: PayrollLine) => round2(l.baseSalary + l.transportAllowance + l.bookingsCommission + l.dealClosedCommission);
export const variance = (l: PayrollLine) => round2(l.sourcePayable - componentSum(l));
export const usdEquivalent = (l: PayrollLine, fx: number) => (l.currency === "USD" ? l.sourcePayable : l.sourcePayable / fx);

// --- CSV ---------------------------------------------------------------------------------------

/** RFC 4180 parser: quoted fields may contain commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (h: string) => h.replace(/\s+/g, " ").trim().toLowerCase();

const COLUMNS: Record<string, string[]> = {
  employeeName: ["employee name", "employee", "name"],
  currency: ["currency"],
  payable: ["payable salary", "net payable", "payable"],
  base: ["base salary", "basic salary", "base"],
  transport: ["transportation allowance", "transport allowance", "transportation"],
  bookings: ["bookings attended coms", "booking attended coms", "bookings attended commission", "bookings commission"],
  deal: ["deal closed coms", "deals closed coms", "deal closed commission", "deal-closed commission"],
  department: ["department", "dept"],
  subDepartment: ["sub department", "sub-department", "subdepartment"],
  designation: ["designation", "title", "job title"],
  company: ["company", "entity"],
  dateJoined: ["date of joining", "joining date", "date joined", "doj"],
  employmentType: ["employment type", "type"],
  employmentStatus: ["employment status", "status"],
  comments: ["comments", "comment", "remarks", "notes"],
};

function columnIndex(headers: string[]) {
  const h = headers.map(norm);
  const out: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(COLUMNS)) {
    const idx = aliases.map((a) => h.indexOf(a)).find((i) => i >= 0);
    if (idx !== undefined) out[key] = idx;
  }
  return out;
}

/** "$1,234.50", "Rs 250,000", "-" -> number | null (null = blank/dash). */
export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/(Rs\.?|PKR|USD|\$|,|\s)/gi, "").trim();
  if (!s || /^[-–—]+$/.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[()]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

function parseDate(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Source RevOps maps to Revenue Operations; anything not in the catalogue stays blank. */
export function mapDepartment(source: string | null, catalogue: string[]): string | null {
  if (!source) return null;
  const s = source.trim();
  if (s.toLowerCase() === "revops") return catalogue.find((d) => d === "Revenue Operations") ?? null;
  return catalogue.find((d) => d.toLowerCase() === s.toLowerCase()) ?? null;
}

const SENSITIVE = /cnic|nic\b|account\s*no|account number|iban|bank|routing|swift|sort code/i;

export function parsePayrollCsv(text: string, sourceName: string, catalogue: string[]): PayrollParse {
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === "employee name"));
  if (headerIdx < 0) throw new Error("Could not find an 'Employee Name' header row in the CSV.");
  const headers = rows[headerIdx];
  const col = columnIndex(headers);
  for (const k of ["employeeName", "currency", "payable"]) {
    if (col[k] === undefined) throw new Error(`Required column missing: ${COLUMNS[k][0]}`);
  }
  const get = (r: string[], k: string) => (col[k] === undefined ? undefined : r[col[k]]);
  const text0 = (v: string | undefined) => (v && v.trim() ? v.replace(/\s+/g, " ").trim() : null);

  const lines: PayrollLine[] = [];
  const sourceTotals: SourceTotal[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const csvRow = i + 1;
    const name = text0(get(r, "employeeName"));
    const currency = (get(r, "currency") ?? "").trim().toUpperCase();
    const payable = parseMoney(get(r, "payable"));
    if (name && (currency === "USD" || currency === "PKR") && payable !== null) {
      const sourceDepartment = text0(get(r, "department"));
      lines.push({
        csvRow,
        employeeName: name,
        sourceDepartment,
        approvedDepartment: mapDepartment(sourceDepartment, catalogue),
        subDepartment: text0(get(r, "subDepartment")),
        designation: text0(get(r, "designation")),
        company: text0(get(r, "company")),
        dateJoined: parseDate(get(r, "dateJoined")),
        employmentType: text0(get(r, "employmentType")),
        employmentStatus: text0(get(r, "employmentStatus")),
        currency,
        baseSalary: parseMoney(get(r, "base")) ?? 0,
        transportAllowance: parseMoney(get(r, "transport")) ?? 0,
        bookingsCommission: parseMoney(get(r, "bookings")) ?? 0,
        dealClosedCommission: parseMoney(get(r, "deal")) ?? 0,
        sourcePayable: payable,
        sourceComments: get(r, "comments")?.trim() || null,
        reviewNote: null,
      });
      continue;
    }
    // Embedded summary / footer tables: keep "total" rows for comparison only, never as employees.
    const joined = r.join(" ");
    if (/total/i.test(joined)) {
      const label = r.map((c) => c.trim()).find((c) => c && parseMoney(c) === null) ?? "Total";
      const usdCell = r.findIndex((c) => /\$/.test(c));
      const pkrCell = r.findIndex((c) => /rs|pkr/i.test(c) && parseMoney(c) !== null);
      const usd = usdCell >= 0 ? parseMoney(r[usdCell]) : currency === "USD" ? payable : null;
      const pkr = pkrCell >= 0 ? parseMoney(r[pkrCell]) : currency === "PKR" ? payable : null;
      if (usd !== null || pkr !== null) sourceTotals.push({ csvRow, label: label.replace(/\s+/g, " ").slice(0, 120), usd, pkr });
    }
  }

  const fxMatch =
    text.match(/(\d{2,4}(?:\.\d+)?)\s*(?:PKR|Rs\.?)\s*(?:per|=|\/)\s*(?:1\s*)?(?:USD|\$)/i) ??
    text.match(/(?:1\s*)?(?:USD|\$)\s*(?:=|:)\s*(?:PKR|Rs\.?)?\s*(\d{2,4}(?:\.\d+)?)/i);
  const fx = fxMatch ? Number(fxMatch[1]) : 277;

  return {
    sourceName,
    payPeriod: null,
    fxPkrPerUsd: fx,
    fxFromSource: Boolean(fxMatch),
    lines,
    sourceTotals,
    departments: catalogue,
  };
}

export function buildExceptions(p: { lines: PayrollLine[]; sourceTotals: SourceTotal[]; payPeriod: string | null; fxPkrPerUsd: number }): PayrollException[] {
  const out: PayrollException[] = [];
  for (const l of p.lines) {
    const v = variance(l);
    if (Math.abs(v) > 0.009) {
      out.push({
        csvRow: l.csvRow,
        subject: l.employeeName,
        issue: "Payable differs from components",
        currency: l.currency,
        components: componentSum(l),
        sourcePayable: l.sourcePayable,
        variance: v,
        evidence: l.sourceComments,
      });
    }
    if (!l.approvedDepartment) {
      out.push({
        csvRow: l.csvRow,
        subject: l.employeeName,
        issue: l.sourceDepartment ? `Source department "${l.sourceDepartment}" is not an approved Sphaera department` : "No department in source",
        currency: l.currency,
        components: null,
        sourcePayable: null,
        variance: null,
        evidence: null,
      });
    }
  }
  if (!p.payPeriod) {
    out.push({ csvRow: null, subject: "Whole file", issue: "Pay period not supplied in source", currency: null, components: null, sourcePayable: null, variance: null, evidence: "Finance must confirm the payroll month before approval." });
  }
  const usdTotal = round2(p.lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.sourcePayable, 0));
  const pkrTotal = round2(p.lines.filter((l) => l.currency === "PKR").reduce((s, l) => s + l.sourcePayable, 0));
  for (const t of p.sourceTotals) {
    const dUsd = t.usd === null ? 0 : round2(t.usd - usdTotal);
    const dPkr = t.pkr === null ? 0 : round2(t.pkr - pkrTotal);
    if (Math.abs(dUsd) > 0.009 || Math.abs(dPkr) > 0.009) {
      out.push({
        csvRow: t.csvRow,
        subject: t.label,
        issue: "Source summary total differs from employee rows",
        currency: null,
        components: null,
        sourcePayable: null,
        variance: null,
        evidence: `USD diff ${dUsd.toLocaleString("en-US")} · PKR diff ${dPkr.toLocaleString("en-US")}`,
      });
    }
  }
  return out;
}

// --- Workbook writer ------------------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
const REVIEW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 30;
}

function title(ws: ExcelJS.Worksheet, t: string, sub: string) {
  ws.getCell("A1").value = t;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = sub;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } };
}

export async function buildReviewWorkbook(p: PayrollParse): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sphaera";
  const n = p.lines.length;
  const first = 5;
  const last = Math.max(first, first + n - 1);
  const rng = (c: string) => `'People Costs'!$${c}$${first}:$${c}$${last}`;

  const start = wb.addWorksheet("START HERE");
  title(start, "Sphaera | People Costs", "Controlled payroll master review | one currency per employee, never posted as ledger expense");
  const startRows: [string, string][] = [
    ["Purpose", "Reconcile payroll-master claims and prepare person/department mapping for the Sphaera People Costs tab."],
    ["Source", p.sourceName],
    ["Employee rows", `${n} employee records; summary and footer tables excluded.`],
    ["Review workflow", "Finance checks Exceptions, confirms deductions, and approves an Approved department for every row before upload back to Sphaera."],
    ["Currencies", "USD and PKR are kept separate. USD equivalents use the exchange rate in Control, which is a source assumption, not a live rate."],
    ["Not a ledger posting", "Payroll master amounts are NOT actual paid expenditure. Only approved person allocations against an existing payment ID count as spend."],
    ["Privacy", "CNIC, bank account numbers and routing details are deliberately excluded from this workbook."],
  ];
  startRows.forEach(([a, b], i) => {
    start.getCell(`A${4 + i}`).value = a;
    start.getCell(`A${4 + i}`).font = { bold: true };
    start.getCell(`B${4 + i}`).value = b;
    start.getCell(`B${4 + i}`).alignment = { wrapText: true };
  });
  start.getColumn(1).width = 22;
  start.getColumn(2).width = 110;

  const control = wb.addWorksheet("Control");
  title(control, "Controls & reconciliation", "FX is the rate supplied in the source; confirm before making payment-level conversions.");
  const ctl: [string, ExcelJS.CellValue][] = [
    ["Source CSV", p.sourceName],
    ["Pay period", p.payPeriod ?? "NOT SUPPLIED"],
    ["PKR per USD", p.fxPkrPerUsd],
    ["Employee count", n],
    ["USD source payable", { formula: `SUMIF(${rng("J")},"USD",${rng("P")})` }],
    ["PKR source payable", { formula: `SUMIF(${rng("J")},"PKR",${rng("P")})` }],
    ["Total USD equivalent", { formula: `SUM(${rng("R")})` }],
    ["Rows needing review", { formula: `COUNTIF(${rng("U")},"Review")` }],
    ["Total variance USD rows", { formula: `SUMIF(${rng("J")},"USD",${rng("Q")})` }],
    ["Total variance PKR rows", { formula: `SUMIF(${rng("J")},"PKR",${rng("Q")})` }],
  ];
  ctl.forEach(([a, b], i) => {
    control.getCell(`A${4 + i}`).value = a;
    control.getCell(`A${4 + i}`).font = { bold: true };
    control.getCell(`B${4 + i}`).value = b;
  });
  control.getCell("B6").numFmt = "0.00";
  for (const r of [8, 9, 10, 12, 13]) control.getCell(`B${r}`).numFmt = "#,##0.00";
  control.getColumn(1).width = 26;
  control.getColumn(2).width = 40;

  const people = wb.addWorksheet("People Costs", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }] });
  title(people, "Payroll master | employee costs", "Amounts stay in source currency. Differences between components and payable are flagged, never overwritten.");
  const headers = [
    "CSV row", "Employee name", "Source department", "Approved department", "Sub department", "Designation", "Company",
    "Date joined", "Employment type", "Currency", "Base salary", "Transport allowance", "Bookings commission",
    "Deal-closed commission", "Component sum", "Source payable", "Variance", "USD equivalent", "Employment status",
    "Source comments", "Review status", "Mapping note",
  ];
  people.getRow(4).values = headers;
  styleHeader(people.getRow(4));
  p.lines.forEach((l, i) => {
    const r = first + i;
    people.getRow(r).values = [
      l.csvRow, l.employeeName, l.sourceDepartment, l.approvedDepartment ?? "", l.subDepartment, l.designation, l.company,
      l.dateJoined ? new Date(l.dateJoined) : null, l.employmentType, l.currency, l.baseSalary, l.transportAllowance,
      l.bookingsCommission, l.dealClosedCommission,
      { formula: `SUM(K${r}:N${r})` }, l.sourcePayable, { formula: `ROUND(P${r}-O${r},2)` },
      { formula: `IF(J${r}="USD",P${r},IF(J${r}="PKR",P${r}/Control!$B$6,0))` }, l.employmentStatus, l.sourceComments,
      { formula: `IF(OR(ABS(Q${r})>0.009,D${r}=""),"Review","OK")` },
      l.reviewNote ?? (l.approvedDepartment ? null : l.sourceDepartment ? "Source department not in approved catalogue" : "No source department"),
    ];
    people.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ["ApprovedDepartments"], showErrorMessage: true, errorTitle: "Not an approved department", error: "Choose a department from the approved Sphaera list." };
    people.getCell(`J${r}`).dataValidation = { type: "list", allowBlank: false, formulae: ["ApprovedCurrencies"], showErrorMessage: true, error: "Currency must be USD or PKR." };
    if (!l.approvedDepartment) people.getCell(`D${r}`).fill = REVIEW_FILL;
    if (Math.abs(variance(l)) > 0.009) people.getCell(`Q${r}`).fill = REVIEW_FILL;
    people.getCell(`H${r}`).numFmt = "yyyy-mm-dd";
    for (const c of ["K", "L", "M", "N", "O", "P", "Q", "R"]) people.getCell(`${c}${r}`).numFmt = "#,##0.00";
    people.getCell(`T${r}`).alignment = { wrapText: true, vertical: "top" };
  });
  const widths = [8, 26, 18, 24, 18, 26, 22, 12, 14, 9, 13, 13, 13, 13, 14, 14, 12, 14, 14, 40, 12, 32];
  widths.forEach((w, i) => (people.getColumn(i + 1).width = w));

  const deptSheet = wb.addWorksheet("Department Summary");
  title(deptSheet, "Department allocation | payroll", "Approved Sphaera departments. USD equivalent uses Control!B6.");
  deptSheet.getRow(4).values = ["Approved department", "Employees", "USD payable", "PKR payable", "USD equivalent", "Review rows"];
  styleHeader(deptSheet.getRow(4));
  p.departments.forEach((d, i) => {
    const r = 5 + i;
    deptSheet.getRow(r).values = [
      d,
      { formula: `COUNTIF(${rng("D")},A${r})` },
      { formula: `SUMIFS(${rng("P")},${rng("D")},A${r},${rng("J")},"USD")` },
      { formula: `SUMIFS(${rng("P")},${rng("D")},A${r},${rng("J")},"PKR")` },
      { formula: `C${r}+D${r}/Control!$B$6` },
      { formula: `COUNTIFS(${rng("D")},A${r},${rng("U")},"Review")` },
    ];
    for (const c of ["C", "D", "E"]) deptSheet.getCell(`${c}${r}`).numFmt = "#,##0.00";
  });
  const unmappedRow = 5 + p.departments.length;
  deptSheet.getRow(unmappedRow).values = [
    "Unmapped (blank)",
    { formula: `COUNTBLANK(${rng("D")})` },
    { formula: `SUMIFS(${rng("P")},${rng("D")},"",${rng("J")},"USD")` },
    { formula: `SUMIFS(${rng("P")},${rng("D")},"",${rng("J")},"PKR")` },
    { formula: `C${unmappedRow}+D${unmappedRow}/Control!$B$6` },
    { formula: `B${unmappedRow}` },
  ];
  deptSheet.getRow(unmappedRow).font = { italic: true };
  [26, 11, 14, 16, 16, 12].forEach((w, i) => (deptSheet.getColumn(i + 1).width = w));

  const exc = wb.addWorksheet("Exceptions");
  title(exc, "Finance review queue", "All pay discrepancies are preserved. The source note may explain a difference but is not approval.");
  exc.getRow(4).values = ["CSV row", "Employee / summary", "Issue", "Currency", "Components", "Source payable", "Variance", "Evidence / source comment", "Review status"];
  styleHeader(exc.getRow(4));
  buildExceptions(p).forEach((e, i) => {
    const r = 5 + i;
    exc.getRow(r).values = [e.csvRow, e.subject, e.issue, e.currency, e.components, e.sourcePayable, e.variance, e.evidence, "Pending Finance review"];
    exc.getCell(`H${r}`).alignment = { wrapText: true, vertical: "top" };
    for (const c of ["E", "F", "G"]) exc.getCell(`${c}${r}`).numFmt = "#,##0.00";
  });
  [8, 26, 40, 9, 14, 14, 12, 50, 22].forEach((w, i) => (exc.getColumn(i + 1).width = w));

  const totals = wb.addWorksheet("Source Totals");
  title(totals, "Conflicting source grand totals", "Grand totals embedded in the source CSV are non-employee rows; compare only, never import them as people.");
  totals.getRow(4).values = ["CSV row", "Source summary USD", "Source summary PKR", "Difference vs payroll USD", "Difference vs payroll PKR", `USD equivalent at ${p.fxPkrPerUsd}`, "Label / treatment"];
  styleHeader(totals.getRow(4));
  p.sourceTotals.forEach((t, i) => {
    const r = 5 + i;
    totals.getRow(r).values = [
      t.csvRow, t.usd, t.pkr,
      { formula: `IF(B${r}="","",B${r}-Control!$B$8)` },
      { formula: `IF(C${r}="","",C${r}-Control!$B$9)` },
      { formula: `IF(C${r}="","",C${r}/Control!$B$6)` },
      `${t.label} · For Finance comparison only. Do not replace the row-level payroll.`,
    ];
    for (const c of ["B", "C", "D", "E", "F"]) totals.getCell(`${c}${r}`).numFmt = "#,##0.00";
  });
  [8, 18, 18, 22, 22, 18, 70].forEach((w, i) => (totals.getColumn(i + 1).width = w));

  const lists = wb.addWorksheet("Approved Lists", { state: "hidden" });
  lists.getRow(1).values = ["Approved departments (Sphaera database)", "Currency"];
  p.departments.forEach((d, i) => (lists.getCell(`A${2 + i}`).value = d));
  lists.getCell("B2").value = "USD";
  lists.getCell("B3").value = "PKR";
  wb.definedNames.add(`'Approved Lists'!$A$2:$A$${Math.max(2, 1 + p.departments.length)}`, "ApprovedDepartments");
  wb.definedNames.add(`'Approved Lists'!$B$2:$B$3`, "ApprovedCurrencies");

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --- Reviewed workbook reader ---------------------------------------------------------------------

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object") {
    if ("result" in v) return (v as { result?: unknown }).result ?? null;
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as { text: string }).text;
    if (v instanceof Date) return v;
  }
  return v;
}
const str = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

/** Reads a reviewed People Costs workbook (this module's layout) back into a PayrollParse. */
export async function readReviewWorkbook(buf: ArrayBuffer, sourceName: string, catalogue: string[]): Promise<PayrollParse> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const people = wb.getWorksheet("People Costs");
  if (!people) throw new Error("Workbook has no 'People Costs' sheet.");
  const header = (people.getRow(4).values as ExcelJS.CellValue[]).slice(1).map((h) => norm(String(cellValue(h) ?? "")));
  if (header[1] !== "employee name" || header[9] !== "currency" || header[15] !== "source payable") {
    throw new Error("The People Costs sheet does not match the Sphaera review layout (row 4 headers).");
  }
  const control = wb.getWorksheet("Control");
  const fx = Number(cellValue(control?.getCell("B6").value ?? null)) || 277;
  const periodRaw = str(cellValue(control?.getCell("B5").value ?? null));
  const payPeriod = periodRaw && /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null;
  const src = str(cellValue(control?.getCell("B4").value ?? null)) ?? sourceName;

  const lines: PayrollLine[] = [];
  people.eachRow((row, r) => {
    if (r < 5) return;
    const v = (c: number) => cellValue(row.getCell(c).value);
    const name = str(v(2));
    const currency = String(v(10) ?? "").trim().toUpperCase();
    const payable = parseMoney(v(16));
    if (!name || (currency !== "USD" && currency !== "PKR") || payable === null) return;
    const approvedRaw = str(v(4));
    const approved = approvedRaw ? catalogue.find((d) => d.toLowerCase() === approvedRaw.toLowerCase()) ?? null : null;
    const joined = v(8);
    lines.push({
      csvRow: Number(v(1)) || r,
      employeeName: name,
      sourceDepartment: str(v(3)),
      approvedDepartment: approved,
      subDepartment: str(v(5)),
      designation: str(v(6)),
      company: str(v(7)),
      dateJoined: joined instanceof Date ? joined.toISOString().slice(0, 10) : parseDate(str(joined) ?? undefined),
      employmentType: str(v(9)),
      employmentStatus: str(v(19)),
      currency,
      baseSalary: parseMoney(v(11)) ?? 0,
      transportAllowance: parseMoney(v(12)) ?? 0,
      bookingsCommission: parseMoney(v(13)) ?? 0,
      dealClosedCommission: parseMoney(v(14)) ?? 0,
      sourcePayable: payable,
      sourceComments: str(v(20)),
      reviewNote: str(v(22)),
    });
  });

  const sourceTotals: SourceTotal[] = [];
  const totals = wb.getWorksheet("Source Totals");
  totals?.eachRow((row, r) => {
    if (r < 5) return;
    const usd = parseMoney(cellValue(row.getCell(2).value));
    const pkr = parseMoney(cellValue(row.getCell(3).value));
    if (usd === null && pkr === null) return;
    const label = str(cellValue(row.getCell(row.cellCount >= 7 ? 7 : 6).value)) ?? "Source total";
    sourceTotals.push({ csvRow: Number(cellValue(row.getCell(1).value)) || r, label: label.split(" · ")[0].slice(0, 120), usd, pkr });
  });

  return { sourceName: src, payPeriod, fxPkrPerUsd: fx, fxFromSource: true, lines, sourceTotals, departments: catalogue };
}

export function assertNoSensitiveColumns(headers: string[]): string[] {
  return headers.filter((h) => SENSITIVE.test(h));
}
