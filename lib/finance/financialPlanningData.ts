import { randomBytes } from "crypto";
// exceljs's bundled .d.ts only declares named exports (no `export default`
// / `export =`), so a namespace import is the type-correct way to pull it
// in — `import ExcelJS from "exceljs"` would fail to compile here even
// though plenty of JS examples use `require('exceljs')` directly.
import * as ExcelJS from "exceljs";
import { prisma } from "../prisma";

// Financial Planning sub-domain, ported from the source Python app's
// server.py — `fiscal_start`/`fy_name`/`fy_months` (the Nov-Oct fiscal
// year convention), `plan_data`, `create_approved_financial_year` (the
// CEO one-step planning form), `preview_financial_plan` /
// `commit_financial_plan` / `approve_financial_plan` (the legacy
// flat-sheet upload round trip), `preview_monthly_plan_workbook` (the
// two-sheet Summary + Cost Head Budgets round trip), and
// `budget_template` (the blank XLSX template generator).
//
// None of FinancePlan/FinancePlanLine/FinancePlanTarget are in the
// source's REVERTIBLE_TABLES undo whitelist, so this file deliberately
// does not touch lib/finance/changeJournal.ts.

// ===========================================================================
// Fiscal year helpers — reusable across the whole Finance module
// ===========================================================================

/**
 * The financial year used throughout Finance is November-to-October, not
 * a calendar year: FY2026/27 runs 1 November 2026 through 31 October 2027.
 * Direct port of the source's `fiscal_start(month)`.
 *
 * Accepts either a Date (fiscal year is derived from its UTC
 * year/month, avoiding local-timezone drift around month boundaries) or
 * a 'YYYY-MM' / 'YYYY-MM-DD' string (the form the source's own callers
 * actually pass), so other sub-domains being ported in parallel (weekly
 * briefs, budget templates, etc.) can reuse this one helper regardless of
 * which shape of month value they have in hand.
 */
export function financeFiscalYearStart(date: Date | string): number {
  let year: number;
  let month: number; // 1-12

  if (typeof date === "string") {
    const match = /^(\d{4})-(\d{2})/.exec(date.trim());
    if (!match) {
      throw new Error(`financeFiscalYearStart: invalid month string "${date}", expected YYYY-MM`);
    }
    year = Number(match[1]);
    month = Number(match[2]);
  } else {
    year = date.getUTCFullYear();
    month = date.getUTCMonth() + 1;
  }

  return month >= 11 ? year : year - 1;
}

/** Direct port of the source's `fy_name(start)`, e.g. 2026 -> "FY2026/27". */
export function financeFyName(fyStart: number): string {
  return `FY${fyStart}/${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

/**
 * The twelve 'YYYY-MM' months of a fiscal year in Nov-Oct order. Direct
 * port of the source's `fy_months(start)`.
 */
export function financeFiscalYearMonths(fyStart: number): string[] {
  const calendarMonths = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return calendarMonths.map((m) => {
    const year = m >= 11 ? fyStart : fyStart + 1;
    return `${year}`.padStart(4, "0") + "-" + String(m).padStart(2, "0");
  });
}

// ===========================================================================
// Shared validation helpers (direct ports of direct_plan_decimal /
// direct_monthly_distribution / input_text / numeric / ym)
// ===========================================================================

const MAX_PLAN_AMOUNT = 100_000_000_000;

/**
 * Validates a monetary input the same way the source's
 * `direct_plan_decimal()` does: required unless optional, non-negative,
 * capped at 100 billion, and rejects (rather than silently rounds) more
 * than 2 decimal places of real precision. The quantize-to-2-decimals at
 * the end mirrors the source's Decimal `ROUND_HALF_UP` safety net.
 */
export function financePlanAmount(value: unknown, label: string, optional = false): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    if (optional) return null;
    throw new Error(`${label} is required.`);
  }
  if (typeof value === "boolean") {
    throw new Error(`${label} must be a monetary amount.`);
  }
  const str = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`${label} must be a non-negative amount with up to 2 decimal places.`);
  }
  const num = Number(str);
  if (!Number.isFinite(num) || num < 0 || num > MAX_PLAN_AMOUNT) {
    throw new Error(`${label} must be a non-negative amount with up to 2 decimal places.`);
  }
  const decimalPart = str.includes(".") ? str.split(".")[1] : "";
  if (decimalPart.length > 2) {
    throw new Error(`${label} must be a non-negative amount with up to 2 decimal places.`);
  }
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Distributes an annual total across the 12 FY months, either from an
 * explicit per-month allocation (which must sum exactly to the annual
 * total) or split evenly in cents with the remainder going to the first
 * months — direct port of `direct_monthly_distribution()`.
 */
export function financeMonthlyDistribution(
  total: number | null,
  supplied: Record<string, unknown> | null | undefined,
  months: string[],
  label: string
): (number | null)[] {
  if (total === null) {
    if (supplied !== null && supplied !== undefined) {
      throw new Error(`${label} monthly figures cannot be supplied without an annual target.`);
    }
    return months.map(() => null);
  }

  if (supplied !== null && supplied !== undefined) {
    if (typeof supplied !== "object" || Array.isArray(supplied)) {
      throw new Error(`${label}: monthly allocation must contain all twelve FY months.`);
    }
    const suppliedKeys = Object.keys(supplied);
    const monthSet = new Set(months);
    const suppliedSet = new Set(suppliedKeys);
    const sameSet =
      suppliedKeys.length === months.length &&
      suppliedKeys.every((k) => monthSet.has(k)) &&
      months.every((m) => suppliedSet.has(m));
    if (!sameSet) {
      throw new Error(`${label}: monthly allocation must contain all twelve FY months.`);
    }
    const values = months.map((m) => financePlanAmount(supplied[m], `${label} ${m}`) as number);
    const sumCents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
    if (sumCents !== Math.round(total * 100)) {
      throw new Error(`${label}: monthly total must equal the annual amount.`);
    }
    return values;
  }

  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / 12);
  const extra = totalCents % 12;
  return months.map((_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

/** Direct port of `input_text()`. */
function financeInputText(value: unknown, label: string, maxLen = 300): string {
  const str = value === null || value === undefined ? "" : String(value).trim();
  if (str.length > maxLen) {
    throw new Error(`${label} exceeds ${maxLen} characters`);
  }
  return str;
}

/**
 * Parses a numeric cell value the way the source's `numeric()` does:
 * strips thousands separators/currency symbols, rejects non-finite or
 * absurdly large values, and rounds to 5 decimal places.
 */
function financeNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "string" ? value.replace(/,/g, "").replace(/\$/g, "").trim() : value;
  if (typeof raw === "string" && raw === "") return null;
  const z = Number(raw);
  if (!Number.isFinite(z) || Math.abs(z) > 1e12) return null;
  return Math.round(z * 1e5) / 1e5;
}

const MONTH_ABBR_LC = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Best-effort port of the source's `ym()` date normalizer, covering the
 * formats most likely to appear in an uploaded planning workbook
 * (ISO 'YYYY-MM'/'YYYY-MM-DD', a Date-valued cell, 'dd/mm/yyyy', and
 * "Nov 2026"/"November 2026" style labels). The source also tries
 * '%b %Y', '%d %b %Y' and '%m/%d/%Y' via Python strptime (server.py
 * ~1017-1026); exotic combinations of those are not individually
 * special-cased here — flagged for double-check if real uploaded
 * workbooks use a date format not covered above.
 */
function financeYm(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(s);
  if (m) return `${m[1]}-${m[2]}`;

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const day = Number(m[1]);
    const monthNum = Number(m[2]);
    if (monthNum >= 1 && monthNum <= 12) {
      return `${m[3]}-${String(monthNum).padStart(2, "0")}`;
    }
    // Fall back to mm/dd/yyyy if the first field can't be a month.
    if (day >= 1 && day <= 12) {
      return `${m[3]}-${String(day).padStart(2, "0")}`;
    }
  }

  const nm = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\W*(20\d{2}|\d{2})\b/i.exec(s);
  if (nm) {
    const monthIdx = MONTH_ABBR_LC.indexOf(nm[1].toLowerCase()) + 1;
    let year = Number(nm[2]);
    if (year < 100) year += 2000;
    return `${year}-${String(monthIdx).padStart(2, "0")}`;
  }

  return null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// ===========================================================================
// Taxonomy lookups
// ===========================================================================

/**
 * Registered departments, ordered the same way the source's
 * `list_departments()` SQL does: the four original departments first (in
 * their original order), then any newly added ones alphabetically
 * (case-insensitive).
 */
async function orderedManagementDepartments(): Promise<string[]> {
  const rows = await prisma.financeManagementDepartment.findMany();
  const priority: Record<string, number> = {
    Marketing: 1,
    Sales: 2,
    Development: 3,
    "D & M Split cost": 4,
  };
  return rows
    .map((r) => r.name)
    .sort((a, b) => {
      const pa = priority[a] ?? 5;
      const pb = priority[b] ?? 5;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
}

/** lowercase name -> canonical-cased name, for case-insensitive cost-head matching. */
async function validCostHeadMap(): Promise<Map<string, string>> {
  const rows = await prisma.financeManagementCostHead.findMany();
  return new Map(rows.map((r) => [r.name.toLowerCase(), r.name]));
}

// ===========================================================================
// plan_data — reads back a plan + its lines/targets
// ===========================================================================

export type FinancePlanDataResult = {
  plans: Awaited<ReturnType<typeof prisma.financePlan.findMany>>;
  lines: Awaited<ReturnType<typeof prisma.financePlanLine.findMany>>;
  targets: Awaited<ReturnType<typeof prisma.financePlanTarget.findMany>>;
};

/** Direct port of the source's `plan_data()`: every plan, plus every line, newest-first. */
export async function financePlanData(): Promise<FinancePlanDataResult> {
  const [plans, lines, targets] = await Promise.all([
    prisma.financePlan.findMany({ orderBy: [{ fyStart: "desc" }, { version: "desc" }] }),
    prisma.financePlanLine.findMany({ orderBy: [{ month: "asc" }, { department: "asc" }, { costHead: "asc" }] }),
    prisma.financePlanTarget.findMany({ orderBy: { month: "asc" } }),
  ]);
  return { plans, lines, targets };
}

// ===========================================================================
// create_approved_financial_year — the CEO one-step planning form
// ===========================================================================

export type CreateApprovedFinancialYearResult =
  | {
      ok: true;
      id: string;
      version: number;
      fy: string;
      status: "Approved";
      spendingBudgetUsd: number;
      annualCollectionsUsd: number;
      annualSalesUsd: number | null;
      heads: number;
      locked: true;
    }
  | { ok: false; status: number; error: string };

/**
 * The CEO planning form: creates AND immediately approves a full annual
 * budget in one step, no spreadsheet round-trip. Direct port of
 * `create_approved_financial_year()` (server.py ~483-536).
 *
 * Validation ported as-is: at least 1 and at most 300 department/cost-head
 * budget lines (NOT full department x cost-head coverage — the source
 * never requires every combination, just a non-empty, non-duplicate,
 * positive-total set of lines), annual collections target required,
 * annual sales target optional, and if this FY already has an approved
 * version, a revision reason of at least 8 characters is required.
 */
export async function createApprovedFinancialYear(
  body: Record<string, unknown>
): Promise<CreateApprovedFinancialYearResult> {
  try {
    const year = Number(body.year);
    if (!Number.isInteger(year)) {
      throw new Error("Choose the financial year, for example 2026 for FY2026/27.");
    }
    if (year < 2025 || year > 2050) {
      throw new Error("Financial year must be between FY2025/26 and FY2050/51.");
    }
    if (body.confirmLock !== true) {
      throw new Error("Confirm that this plan must be approved and locked.");
    }
    const name = financeInputText(body.name, "Plan name", 120) || `${financeFyName(year)} management plan`;
    const reason = financeInputText(body.revisionReason, "Revision reason", 500);
    const months = financeFiscalYearMonths(year);

    const annualSales = financePlanAmount(body.annualSalesUsd, "Annual sales target", true);
    const annualCollections = financePlanAmount(body.annualCollectionsUsd, "Annual collections target") as number;
    const salesMonths = financeMonthlyDistribution(
      annualSales,
      body.monthlySales as Record<string, unknown> | null | undefined,
      months,
      "Sales target"
    );
    const collMonths = financeMonthlyDistribution(
      annualCollections,
      body.monthlyCollections as Record<string, unknown> | null | undefined,
      months,
      "Collections target"
    );

    const rows = body.budgets;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 300) {
      throw new Error("Add at least one department and cost-head budget (maximum 300).");
    }

    const validHeads = await validCostHeadMap();
    const allowedDepartments = new Set(await orderedManagementDepartments());

    const processed: Array<{ department: string; head: string; monthly: number[] }> = [];
    const seen = new Set<string>();
    let allTotal = 0;

    rows.forEach((entry, i) => {
      const ix = i + 1;
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new Error("Each cost-head budget must be a record.");
      }
      const e = entry as Record<string, unknown>;
      const department = String(e.department ?? "").trim();
      let head = String(e.costHead ?? "").trim();
      if (!allowedDepartments.has(department)) {
        throw new Error(`Budget ${ix}: invalid department.`);
      }
      const canonical = validHeads.get(head.toLowerCase());
      if (!canonical) {
        throw new Error(`Budget ${ix}: choose an existing cost head from Organise Costs.`);
      }
      head = canonical;
      const key = `${department}\u0000${head.toLowerCase()}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate cost head: ${department} / ${head}. Combine into one line.`);
      }
      seen.add(key);
      const amount = financePlanAmount(e.annualBudgetUsd, `${department} / ${head}`) as number;
      const monthly = financeMonthlyDistribution(
        amount,
        e.monthly as Record<string, unknown> | null | undefined,
        months,
        `${department} / ${head}`
      ) as number[];
      processed.push({ department, head, monthly });
      allTotal += amount;
    });
    allTotal = Math.round(allTotal * 100) / 100;

    if (!allTotal) {
      throw new Error("Enter an annual spending budget greater than zero before locking the plan.");
    }

    const approvedCount = await prisma.financePlan.count({ where: { fyStart: year, status: "Approved" } });
    if (approvedCount > 0 && reason.length < 8) {
      throw new Error(
        "This FY already has an approved plan. Explain why a revised version is required (at least 8 characters)."
      );
    }

    const maxVersion = await prisma.financePlan.aggregate({
      where: { fyStart: year },
      _max: { version: true },
    });
    const version = (maxVersion._max.version ?? 0) + 1;

    const now = new Date();
    const plan = await prisma.financePlan.create({
      data: {
        fyStart: year,
        version,
        name,
        status: "Approved",
        createdAt: now,
        approvedAt: now,
      },
    });

    const lineInserts = processed.flatMap(({ department, head, monthly }) =>
      months.map((month, i) => ({
        planId: plan.id,
        month,
        department,
        costHead: head,
        budgetUsd: monthly[i],
      }))
    );
    if (lineInserts.length > 0) {
      await prisma.financePlanLine.createMany({ data: lineInserts });
    }

    // FinancePlanTarget's columns are non-nullable Floats (@default(0)) in
    // this port, unlike the source's nullable REAL columns — an omitted
    // optional annual sales target is stored as 0 rather than NULL.
    await prisma.financePlanTarget.createMany({
      data: months.map((month, i) => ({
        planId: plan.id,
        month,
        salesTargetUsd: salesMonths[i] ?? 0,
        collectionsTargetUsd: collMonths[i] ?? 0,
      })),
    });

    return {
      ok: true,
      id: plan.id,
      version,
      fy: financeFyName(year),
      status: "Approved",
      spendingBudgetUsd: allTotal,
      annualCollectionsUsd: annualCollections,
      annualSalesUsd: annualSales,
      heads: processed.length,
      locked: true,
    };
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : String(err) };
  }
}

// ===========================================================================
// preview / commit / approve round trip
// ===========================================================================

export type PlanPreviewIssue = {
  row: number;
  error: string;
  month?: string | null;
  department?: string;
  costHead?: string;
};

export type PlanPreviewRow = { month: string; department: string; costHead: string; budgetUsd: number };
export type PlanPreviewTarget = { month: string; salesTargetUsd: number | null; collectionsTargetUsd: number | null };

type PlanPreviewRecord = {
  rows: PlanPreviewRow[];
  targets: PlanPreviewTarget[];
  fy: number;
  created: number;
  filename: string;
  errors: PlanPreviewIssue[];
};

// In-memory preview cache, direct equivalent of the source's module-level
// PLAN_PREVIEWS dict (same 30-minute TTL). NOTE: this is per-process —
// it will not survive a server restart and is not shared across multiple
// Node instances behind a load balancer. That matches the source's own
// single-process Flask app, but if this module ends up running
// horizontally scaled, previews should move to a shared store (DB/Redis)
// in a later stage.
const PLAN_PREVIEWS = new Map<string, PlanPreviewRecord>();
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_PLAN_LINES = 10000;

function makePreviewToken(): string {
  return randomBytes(18).toString("base64url");
}

export type PlanPreviewResult =
  | {
      ok: true;
      token: string;
      year: number;
      fy: string;
      filename: string;
      format: string;
      valid: number;
      targets: number;
      emptySkipped: number;
      invalid: number;
      issues: PlanPreviewIssue[];
      totalUsd: number;
      sample: PlanPreviewRow[];
      ready: boolean;
      note?: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Validates an uploaded XLSX workbook against a chosen financial year and
 * stores a short-lived preview for later commit. Direct port of
 * `preview_financial_plan()` (server.py ~538-586): dispatches to the
 * two-sheet format if a 'Cost Head Budgets' sheet is present, otherwise
 * parses the legacy flat Month/Department/CostHead/BudgetUSD layout.
 */
export async function previewFinancialPlan(
  content: Buffer,
  filename: string,
  fy: unknown
): Promise<PlanPreviewResult> {
  try {
    if (
      !filename.toLowerCase().endsWith(".xlsx") ||
      content.length > MAX_UPLOAD_BYTES ||
      content.subarray(0, 2).toString("latin1") !== "PK"
    ) {
      throw new Error("Upload a valid XLSX file of up to 25 MB.");
    }
    const year = Number(fy);
    if (!Number.isInteger(year)) {
      throw new Error("Select a financial year first.");
    }
    if (year < 2015 || year > 2050) {
      throw new Error("Unsupported financial year.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content);

    if (workbook.getWorksheet("Cost Head Budgets")) {
      return await previewMonthlyPlanWorkbook(workbook, filename, year);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("This workbook has no column headings.");

    const headerRow = sheet.getRow(1);
    const headers: unknown[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = cell.value;
    });
    if (headers.length === 0) throw new Error("This workbook has no column headings.");

    const lookup = new Map<string, number>();
    headers.forEach((v, i) => {
      if (i === 0) return;
      const key = normalizeKey(v);
      if (key) lookup.set(key, i);
    });
    const required: Record<string, string> = {
      month: "Month",
      department: "Department",
      costhead: "Cost Head",
      budgetusd: "Budget USD",
    };
    const missing = Object.entries(required)
      .filter(([k]) => !lookup.has(k))
      .map(([, label]) => label);
    if (missing.length > 0) {
      throw new Error(`Missing columns: ${missing.join(", ")}. Download the planning template.`);
    }

    const validHeads = await validCostHeadMap();
    const allowedDepartments = new Set(await orderedManagementDepartments());
    const fyMonths = new Set(financeFiscalYearMonths(year));

    const records: PlanPreviewRow[] = [];
    const issues: PlanPreviewIssue[] = [];
    const seen = new Set<string>();
    let blank = 0;

    const col = (rowValues: unknown[], key: string): unknown => {
      const ix = lookup.get(key)!;
      return ix < rowValues.length ? rowValues[ix] : undefined;
    };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const raw: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        raw[colNumber] = cell.value;
      });
      if (raw.length === 0) continue;
      const hasAny = raw.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasAny) continue;

      const val = col(raw, "budgetusd");
      if (val === null || val === undefined || String(val).trim() === "") {
        blank++;
        continue;
      }
      const month = financeYm(col(raw, "month"));
      const department = String(col(raw, "department") ?? "").trim();
      const head = String(col(raw, "costhead") ?? "").trim();
      const amount = financeNumeric(val);

      const errs: string[] = [];
      if (!month || !fyMonths.has(month)) errs.push(`Month is outside ${financeFyName(year)}`);
      if (!allowedDepartments.has(department)) errs.push("Unknown department");
      if (!validHeads.has(head.toLowerCase())) errs.push("Cost head must exist in Organise Costs");
      if (amount === null || amount < 0) errs.push("Budget must be zero or positive");
      const key = `${month}\u0000${department}\u0000${head.toLowerCase()}`;
      if (seen.has(key)) errs.push("Duplicate month, department and cost head");

      if (errs.length > 0) {
        issues.push({
          row: rowNumber,
          error: errs.join("; "),
          month: col(raw, "month") === undefined ? null : String(col(raw, "month")),
          department,
          costHead: head,
        });
      } else {
        seen.add(key);
        records.push({
          month: month as string,
          department,
          costHead: validHeads.get(head.toLowerCase())!,
          budgetUsd: amount as number,
        });
      }
      if (records.length + issues.length > MAX_PLAN_LINES) {
        throw new Error("Plan is limited to 10,000 populated lines.");
      }
    }

    if (records.length === 0) {
      throw new Error("No valid budget rows found. Enter at least one amount in Budget USD.");
    }

    const token = makePreviewToken();
    PLAN_PREVIEWS.set(token, {
      rows: records,
      targets: [],
      fy: year,
      created: Date.now(),
      filename,
      errors: issues,
    });

    return {
      ok: true,
      token,
      year,
      fy: financeFyName(year),
      filename,
      format: "Legacy budget lines",
      valid: records.length,
      emptySkipped: blank,
      invalid: issues.length,
      issues: issues.slice(0, 30),
      totalUsd: Math.round(records.reduce((acc, r) => acc + r.budgetUsd, 0) * 100) / 100,
      sample: records.slice(0, 12),
      targets: 0,
      ready: issues.length === 0,
    };
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Same Nov-Oct annual planning layout as the legacy flat upload, but read
 * from the two-sheet Summary + Cost Head Budgets workbook produced by
 * `generateBudgetTemplate()`. Never looks at any detail/payment/actual
 * sheet, even if one is accidentally included. Direct port of
 * `preview_monthly_plan_workbook()` (server.py ~616-670).
 */
async function previewMonthlyPlanWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string,
  year: number
): Promise<PlanPreviewResult> {
  try {
    const sheet = workbook.getWorksheet("Cost Head Budgets")!;
    const validHeads = await validCostHeadMap();
    const allowedDepartments = new Set(await orderedManagementDepartments());
    const months = financeFiscalYearMonths(year);
    const labels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

    for (let j = 3; j <= 14; j++) {
      const v = sheet.getCell(5, j).value;
      const label = labels[j - 3];
      const okLabel =
        normalizeKey(v) === normalizeKey(label) ||
        normalizeKey(v) === normalizeKey(months[j - 3]) ||
        normalizeKey(v) === normalizeKey(`${label} budget`);
      if (!okLabel) {
        throw new Error("Cost Head Budgets must have November to October columns C to N in that order.");
      }
    }

    const rows: PlanPreviewRow[] = [];
    const issues: PlanPreviewIssue[] = [];
    const seen = new Set<string>();
    let blank = 0;

    for (let i = 6; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const dep = String(row.getCell(1).value ?? "").trim();
      const head = String(row.getCell(2).value ?? "").trim();
      const values: unknown[] = [];
      for (let j = 3; j <= 14; j++) values.push(row.getCell(j).value);

      const anyValue = values.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!dep && !head && !anyValue) continue;
      if (!anyValue) {
        blank++;
        continue;
      }

      values.forEach((v, j) => {
        if (v === null || v === undefined || String(v).trim() === "") return;
        const month = months[j];
        const num = financeNumeric(v);
        const errs: string[] = [];
        if (!allowedDepartments.has(dep)) errs.push("Unknown department");
        if (!validHeads.has(head.toLowerCase())) errs.push("Cost head must exist in Organise Costs");
        if (num === null || num < 0) errs.push("Budget must be zero or positive");
        const key = `${month}\u0000${dep}\u0000${head.toLowerCase()}`;
        if (seen.has(key)) errs.push("Duplicate department, cost head and month");

        if (errs.length > 0) {
          issues.push({ row: i, month, department: dep, costHead: head, error: errs.join("; ") });
        } else {
          seen.add(key);
          rows.push({ month, department: dep, costHead: validHeads.get(head.toLowerCase())!, budgetUsd: num as number });
        }
      });

      if (rows.length + issues.length > MAX_PLAN_LINES) {
        throw new Error("Plan is limited to 10,000 populated budget entries.");
      }
    }

    const targets: PlanPreviewTarget[] = [];
    const summarySheet = workbook.getWorksheet("Summary");
    if (summarySheet) {
      for (let j = 5, mi = 0; j <= 16; j++, mi++) {
        const month = months[mi];
        const label = String(summarySheet.getCell(j, 3).value ?? "").trim();
        const monthNum = Number(month.slice(5));
        if (label && normalizeKey(label) !== normalizeKey(MONTH_NAMES[monthNum]) && normalizeKey(label) !== normalizeKey(MONTH_ABBR[monthNum])) {
          issues.push({ row: j, error: "Summary month does not match the financial year month order", month });
          continue;
        }
        const sales = summarySheet.getCell(j, 9).value;
        const collectionsVal = summarySheet.getCell(j, 15).value;
        if ((sales === null || sales === undefined) && (collectionsVal === null || collectionsVal === undefined)) continue;
        const sn =
          sales !== null && sales !== undefined && String(sales).trim() !== "" ? financeNumeric(sales) : null;
        const cn =
          collectionsVal !== null && collectionsVal !== undefined && String(collectionsVal).trim() !== ""
            ? financeNumeric(collectionsVal)
            : null;
        const salesInvalid = sales !== null && sales !== undefined && String(sales).trim() !== "" && (sn === null || sn < 0);
        const collInvalid =
          collectionsVal !== null &&
          collectionsVal !== undefined &&
          String(collectionsVal).trim() !== "" &&
          (cn === null || cn < 0);
        if (salesInvalid || collInvalid) {
          issues.push({ row: j, error: "Sales and collections plan values must be non-negative numbers", month });
        } else {
          targets.push({ month, salesTargetUsd: sn, collectionsTargetUsd: cn });
        }
      }
    }

    if (rows.length === 0 && issues.length === 0) {
      throw new Error("No cost-head budgets found. Fill in Cost Head Budgets, not an expense transaction sheet.");
    }

    const token = makePreviewToken();
    PLAN_PREVIEWS.set(token, {
      rows,
      targets,
      fy: year,
      created: Date.now(),
      filename,
      errors: issues,
    });

    return {
      ok: true,
      token,
      year,
      fy: financeFyName(year),
      filename,
      format: "November to October annual plan",
      valid: rows.length,
      targets: targets.length,
      emptySkipped: blank,
      invalid: issues.length,
      issues: issues.slice(0, 30),
      totalUsd: Math.round(rows.reduce((acc, r) => acc + r.budgetUsd, 0) * 100) / 100,
      sample: rows.slice(0, 12),
      ready: issues.length === 0,
      note: "Budget and sales/collections targets only. No actual payments or expenditure are imported.",
    };
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : String(err) };
  }
}

export type CommitPlanResult =
  | { ok: true; id: string; version: number; fy: string; status: "Draft"; lines: number; targets: number }
  | { ok: false; status: number; error: string };

/** Direct port of `commit_financial_plan()`: materializes a validated preview as a Draft plan. */
export async function commitFinancialPlan(body: { token: unknown; name?: unknown }): Promise<CommitPlanResult> {
  const token = String(body.token ?? "");
  const rec = PLAN_PREVIEWS.get(token);
  if (!rec || Date.now() - rec.created > PREVIEW_TTL_MS) {
    return { ok: false, status: 400, error: "Budget preview expired. Upload again." };
  }
  if (rec.errors.length > 0) {
    return { ok: false, status: 400, error: "Fix invalid rows before uploading the plan." };
  }

  const name = financeInputText(body.name, "Plan name", 100) || `${financeFyName(rec.fy)} budget proposal`;

  const maxVersion = await prisma.financePlan.aggregate({
    where: { fyStart: rec.fy },
    _max: { version: true },
  });
  const version = (maxVersion._max.version ?? 0) + 1;

  const plan = await prisma.financePlan.create({
    data: { fyStart: rec.fy, version, name, status: "Draft" },
  });

  if (rec.rows.length > 0) {
    await prisma.financePlanLine.createMany({
      data: rec.rows.map((r) => ({
        planId: plan.id,
        month: r.month,
        department: r.department,
        costHead: r.costHead,
        budgetUsd: r.budgetUsd,
      })),
    });
  }
  if (rec.targets.length > 0) {
    await prisma.financePlanTarget.createMany({
      data: rec.targets.map((t) => ({
        planId: plan.id,
        month: t.month,
        // Non-nullable Float columns in this port — see note in
        // createApprovedFinancialYear().
        salesTargetUsd: t.salesTargetUsd ?? 0,
        collectionsTargetUsd: t.collectionsTargetUsd ?? 0,
      })),
    });
  }

  PLAN_PREVIEWS.delete(token);

  return {
    ok: true,
    id: plan.id,
    version,
    fy: financeFyName(rec.fy),
    status: "Draft",
    lines: rec.rows.length,
    targets: rec.targets.length,
  };
}

export type ApprovePlanResult =
  | { ok: true; id: string; status: "Approved"; rows: number }
  | { ok: false; status: number; error: string };

/** Direct port of `approve_financial_plan()`. */
export async function approveFinancialPlan(body: { id: unknown }): Promise<ApprovePlanResult> {
  const id = financeInputText(body.id, "Plan id", 100);
  const plan = await prisma.financePlan.findUnique({ where: { id } });
  if (!plan) return { ok: false, status: 404, error: "Plan not found" };
  if (plan.status === "Approved") {
    return { ok: false, status: 409, error: "This version is already approved." };
  }
  const count = await prisma.financePlanLine.count({ where: { planId: id } });
  if (!count) return { ok: false, status: 400, error: "Plan has no budget lines" };

  await prisma.financePlan.update({ where: { id: plan.id }, data: { status: "Approved", approvedAt: new Date() } });

  return { ok: true, id, status: "Approved", rows: count };
}

// ===========================================================================
// budget_template — blank XLSX template generator
// ===========================================================================

// Default department -> cost-head seed rows for the template grid. Any
// registered cost head may be used under any department (this mapping
// only decides which rows the template pre-populates). Direct port of
// the `mappings` dict in `budget_template()`.
const DEFAULT_DEPARTMENT_COST_HEADS: Record<string, string[]> = {
  Marketing: [
    "Paid Marketing",
    "Advertising",
    "Public Relations & Media",
    "Branding & Design",
    "Content, Video & Photography",
    "CGI & Animation",
    "Events & Exhibitions",
    "Venue & Event Hire",
    "Event Production & Materials",
    "Lead Generation & Market Research",
    "Printing & Promotional Materials",
    "Salaries",
    "Travel & Accommodation",
  ],
  Sales: [
    "Salaries",
    "Commissions",
    "Agency & Referral Fees",
    "Bonuses & Incentives",
    "Travel & Accommodation",
    "Meals & Entertainment",
    "Business Development",
    "Reimbursements",
    "Software & Subscriptions",
  ],
  Development: [
    "Salaries",
    "Project Delivery",
    "Site Surveys & Technical Design",
    "Planning & Building Permits",
    "Contractors & Consultants",
    "Professional & Legal Fees",
    "Travel & Accommodation",
  ],
  "D & M Split cost": [
    "Rent & Facilities",
    "Employer Payroll Taxes",
    "Staff Benefits & Pensions",
    "Recruitment",
    "Training & Development",
    "Utilities & Maintenance",
    "Telephone & Internet",
    "Office Administration",
    "Software & Subscriptions",
    "IT & Equipment",
    "Professional & Legal Fees",
    "Bank & Merchant Charges",
    "Insurance",
    "Licences & Permits",
    "Security",
    "Vehicle & Transport",
    "Postage & Couriers",
    "Donations & CSR",
  ],
};
const DEFAULT_FALLBACK_HEADS = ["Salaries", "Software & Subscriptions", "Professional & Legal Fees"];

function columnLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

const NAVY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12374B" } };
const WHITE_BOLD_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
const BLUE_INPUT_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF0000FF" } };
const MONEY_FORMAT = "#,##0.00;[Red](#,##0.00);-";

/**
 * Generates the blank annual budget XLSX template: a Summary sheet with
 * monthly Sales/Collections target inputs and department rollup
 * formulas, and a Cost Head Budgets sheet as a department x
 * approved-cost-head x 12-month grid with a data-validation dropdown on
 * the Department column restricted to the live taxonomy. Contains zero
 * actual figures by design — "Enter PLANNED costs only." Direct port of
 * `budget_template()` (server.py ~673-755).
 *
 * Note: the source only adds a dropdown to the Department column (not
 * Cost Head) — ported faithfully as-is. If a Cost Head dropdown is
 * actually wanted, that would be a deliberate enhancement beyond the
 * source, not a straight port.
 */
export async function generateBudgetTemplate(year: number): Promise<Buffer> {
  if (!Number.isInteger(year) || year < 2015 || year > 2050) {
    throw new Error("Invalid financial year");
  }

  const [allHeads, registeredDepartments] = await Promise.all([
    prisma.financeManagementCostHead.findMany({ orderBy: { name: "asc" } }).then((rows) => rows.map((r) => r.name)),
    orderedManagementDepartments(),
  ]);
  const allHeadsSet = new Set(allHeads);

  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Summary");
  const heads = workbook.addWorksheet("Cost Head Budgets");

  // --- Cost Head Budgets sheet -------------------------------------------
  heads.getCell(1, 1).value = "ONE HOMES | ANNUAL COST HEAD BUDGET";
  heads.mergeCells("A1:P1");
  heads.getCell(2, 1).value = `${financeFyName(year)} | November ${year} to October ${year + 1} | USD`;
  heads.mergeCells("A2:P2");
  heads.getCell(3, 1).value = "Enter PLANNED costs only. Leave a cell blank for no budget; 0 is an intentional zero budget.";
  heads.mergeCells("A3:P3");

  const gridHeaders = [
    "Department",
    "Cost Head",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Annual Total",
    "Notes",
  ];
  gridHeaders.forEach((h, i) => {
    heads.getCell(5, i + 1).value = h;
  });

  let idx = 6;
  for (const dep of registeredDepartments) {
    const candidateHeads = DEFAULT_DEPARTMENT_COST_HEADS[dep] ?? DEFAULT_FALLBACK_HEADS;
    for (const head of candidateHeads) {
      if (!allHeadsSet.has(head)) continue;
      heads.getCell(idx, 1).value = dep;
      heads.getCell(idx, 2).value = head;
      heads.getCell(idx, 15).value = { formula: `SUM(C${idx}:N${idx})` };
      idx++;
    }
  }
  const lastDataRow = idx - 1;

  heads.views = [{ state: "frozen", xSplit: 2, ySplit: 5, showGridLines: false }];
  heads.autoFilter = `A5:P${lastDataRow}`;
  heads.getColumn(1).width = 25;
  heads.getColumn(2).width = 37;
  heads.getColumn(16).width = 35;
  for (let j = 3; j <= 15; j++) heads.getColumn(j).width = 16;
  for (let r = 6; r <= lastDataRow; r++) {
    for (let j = 3; j <= 15; j++) {
      heads.getCell(r, j).numFmt = MONEY_FORMAT;
    }
  }

  // Hidden "Approved Departments" sheet + named range + dropdown, direct
  // port of lines 710-716.
  const listSheet = workbook.addWorksheet("Approved Departments");
  registeredDepartments.forEach((dep, i) => {
    listSheet.getCell(i + 1, 1).value = dep;
  });
  listSheet.state = "hidden";

  workbook.definedNames.add(`'Approved Departments'!$A$1:$A$${registeredDepartments.length}`, "ApprovedDepartments");
  // Dropdown restricted to the live department taxonomy, direct port of
  // the source's single-range `name_validation.add('A6:A{max}')`. The
  // exceljs 4.x public typings only expose data validation per cell
  // (Cell.dataValidation), not a worksheet-level ranged `.add()`, so this
  // assigns the same validation rule to each cell in the range instead —
  // functionally identical dropdown behaviour in Excel.
  const dropdownMaxRow = Math.max(lastDataRow + 100, 150);
  for (let r = 6; r <= dropdownMaxRow; r++) {
    heads.getCell(r, 1).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=ApprovedDepartments"],
    };
  }

  // --- Summary sheet -------------------------------------------------------
  summary.getCell(1, 3).value = "ONE HOMES | FINANCIAL PLAN";
  summary.getCell(2, 3).value = `${financeFyName(year)} | Nov ${year} to Oct ${year + 1} | Planned values only, USD`;

  const summaryLabelCols: Array<[string, number, string]> = [
    ["C", 3, "Month"],
    ["I", 9, "Sales"],
    ["O", 15, "Collection"],
    ["U", 21, "Marketing"],
    ["AA", 27, "Sales"],
    ["AG", 33, "Development"],
    ["AM", 39, "D & M Split cost"],
    ["AS", 45, "Total Expenses"],
  ];
  for (const [, col, label] of summaryLabelCols) {
    summary.getCell(3, col).value = label;
  }
  for (const col of [9, 15, 21, 27, 33, 39, 45]) {
    summary.getCell(4, col).value = "Budget / Target USD";
  }

  const months = financeFiscalYearMonths(year);
  const monthNames = [
    "November",
    "December",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
  ];
  const rollupDepartments: Array<[number, string]> = [
    [21, "Marketing"],
    [27, "Sales"],
    [33, "Development"],
    [39, "D & M Split cost"],
  ];

  for (let i = 0; i < 12; i++) {
    const row = i + 5;
    summary.getCell(row, 3).value = monthNames[i];
    summary.getCell(row, 4).value = months[i];
    const gridCol = columnLetter(3 + i);
    for (const [column, dept] of rollupDepartments) {
      summary.getCell(row, column).value = {
        formula: `SUMIF('Cost Head Budgets'!$A$6:$A$600,"${dept}",'Cost Head Budgets'!$${gridCol}$6:$${gridCol}$600)`,
      };
    }
    summary.getCell(row, 45).value = { formula: `SUM('Cost Head Budgets'!${gridCol}6:${gridCol}600)` };
    summary.getCell(row, 9).numFmt = "#,##0.00";
    summary.getCell(row, 15).numFmt = "#,##0.00";
  }

  summary.getCell(18, 3).value = "FY Total";
  for (const col of [9, 15, 21, 27, 33, 39, 45]) {
    const letter = columnLetter(col);
    summary.getCell(18, col).value = { formula: `SUM(${letter}5:${letter}16)` };
  }

  summary.getColumn(3).width = 18;
  summary.getColumn(4).width = 18;
  for (const col of [9, 15, 21, 27, 33, 39, 45]) {
    summary.getColumn(col).width = 22;
  }
  summary.views = [{ state: "frozen", xSplit: 4, ySplit: 4, showGridLines: false }];

  // --- Styling --------------------------------------------------------------
  for (let j = 1; j <= 16; j++) {
    const cell = heads.getCell(5, j);
    cell.fill = NAVY_FILL;
    cell.font = WHITE_BOLD_FONT;
  }
  for (const [, col] of summaryLabelCols) {
    const cell = summary.getCell(3, col);
    cell.fill = NAVY_FILL;
    cell.font = WHITE_BOLD_FONT;
  }
  for (let i = 5; i <= 16; i++) {
    summary.getCell(i, 9).font = BLUE_INPUT_FONT;
    summary.getCell(i, 15).font = BLUE_INPUT_FONT;
  }
  for (let r = 6; r < idx; r++) {
    for (let j = 3; j <= 14; j++) {
      heads.getCell(r, j).font = BLUE_INPUT_FONT;
    }
  }

  // --- Instructions sheet -----------------------------------------------
  const guidance = workbook.addWorksheet("Instructions");
  guidance.getColumn(1).width = 120;
  const lines = [
    "ANNUAL PLAN ONLY | There are no actual expenses or ERP payments in this workbook.",
    `Financial year: ${financeFyName(year)} (1 November ${year} to 31 October ${year + 1})`,
    "1. In Summary, fill monthly SALES and COLLECTIONS targets in the blue input columns I and O.",
    "2. In Cost Head Budgets, enter monthly USD budget in columns C to N against the department and existing cost head.",
    "3. Summary totals include all registered departments. The original four summary columns show only those four departments.",
    "4. You may add more rows beneath the existing heads. Heads must already be registered in Organise Costs.",
    "5. The dashboard imports only Summary targets and Cost Head Budgets, never payments from this plan file.",
    "6. Actual spending, sales, collections and bank balances will be fed independently from the ERP once integrated.",
    "7. You may save a draft and approve it; replacing a draft never overwrites prior approved plans.",
  ];
  lines.forEach((text, i) => {
    guidance.getCell(i + 1, 1).value = text;
  });

  // Best-effort port of `w.calculation.fullCalcOnLoad=True` — forces Excel
  // to recompute all formulas on open rather than trusting cached values
  // (there are none, since this is a blank template).
  workbook.calcProperties.fullCalcOnLoad = true;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
