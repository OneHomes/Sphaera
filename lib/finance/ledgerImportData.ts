import * as ExcelJS from "exceljs";
import crypto from "crypto";
import { prisma } from "../prisma";

// Direct port of the source Python app's parse_file()/preview_import()/
// commit_import() (server.py ~line 1626-1721) — the "Upload more months"
// screen's backend. Reads the same "Cost Centre Detail" consolidated tab
// (plus any not-yet-reflected monthly Marketing/Sales & OH tabs) that the
// original ingests, computes the same stable fingerprint-based duplicate
// detection, and inserts only genuinely new rows.
//
// Stateless-deployment difference from the source: the Python server kept
// a single in-memory PREVIEWS dict keyed by a token, so /api/import/commit
// only needed that token. A Next.js API route on serverless infra can't
// assume the commit request lands on the same instance that handled the
// preview, so the full parsed "new rows" list round-trips through the
// client instead (returned by previewLedgerImport, sent back unchanged to
// commitLedgerImport) — same net effect, no server-side session state.

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function normal(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .split(/\s+/)
    .join(" ");
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  let n: number;
  if (typeof value === "string") {
    n = Number(value.replace(/,/g, "").replace(/\$/g, "").trim());
  } else if (value instanceof Date) {
    return null;
  } else if (typeof value === "object" && value !== null && "result" in (value as Record<string, unknown>)) {
    // exceljs formula cell — use the computed result
    return numeric((value as { result?: unknown }).result);
  } else {
    n = Number(value);
  }
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) return null;
  return Math.round(n * 1e5) / 1e5;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Direct port of ym() — resolves a Date/string/sheet-name into a "YYYY-MM" string, or null. */
function ym(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}`;
  }
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // d/m/Y (source's primary slash format)
  if (m) return `${m[3]}-${pad2(Number(m[2]))}`;

  const monthRe = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\W*(\d{4}|\d{2})/i;
  const mm = s.match(monthRe);
  if (mm) {
    const monthIdx = MONTH_NAMES.indexOf(mm[1].slice(0, 3).toLowerCase());
    let year = Number(mm[2]);
    if (year < 100) year += 2000;
    if (monthIdx >= 0) return `${year}-${pad2(monthIdx + 1)}`;
  }
  return null;
}

/** Direct port of date_iso(). */
function dateIso(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
  return "";
}

export type ParsedLedgerRow = {
  month: string;
  date: string;
  description: string;
  costCentre: string;
  head: string;
  country: string;
  amount: number;
  sourceSheet: string;
  sourceRow: number;
  sourceFile: string;
  fingerprint: string;
  reviewGroup: string;
  occurrence: number;
};

/** Direct port of fingerprint() — stable identity ignoring cost-head remapping. */
function computeFingerprint(row: {
  month: string;
  date: string;
  description: string;
  amount: number;
  country: string;
}): string {
  const key = [row.month, row.date || "", normal(row.description), row.amount.toFixed(5), normal(row.country)];
  return crypto.createHash("sha256").update(JSON.stringify(key)).digest("hex");
}

/** Direct port of make_tx(). Returns null (an "invalid row") when month/description/amount can't be resolved. */
function makeTx(
  raw: {
    month?: unknown;
    date?: unknown;
    description?: unknown;
    costCentre?: unknown;
    head?: unknown;
    country?: unknown;
    amount?: unknown;
    sourceSheet?: unknown;
    sourceRow?: unknown;
  },
  sourceFilename: string
): Omit<ParsedLedgerRow, "occurrence"> | null {
  const month = ym(raw.month) ?? ym(raw.date) ?? ym(raw.sourceSheet);
  const description = String(raw.description ?? "").trim();
  const amount = numeric(raw.amount);
  if (!month || !description || amount === null) return null;

  const costCentre = String(raw.costCentre ?? "Unclassified").trim() || "Unclassified";
  const head = String(raw.head ?? "Unclassified").trim() || "Unclassified";
  const country = String(raw.country ?? "Unspecified").trim() || "Unspecified";
  const date = dateIso(raw.date);
  const row = {
    month,
    date,
    description,
    costCentre,
    head,
    country,
    amount,
    sourceSheet: String(raw.sourceSheet ?? "").trim(),
    sourceRow: Number(raw.sourceRow ?? 0) || 0,
    sourceFile: sourceFilename,
  };
  const fingerprint = computeFingerprint(row);
  const reviewGroup = normal(costCentre) === "unclassified" || normal(head) === "unclassified" ? "Unidentified" : "Routine";
  return { ...row, fingerprint, reviewGroup };
}

const COST_CENTRE_DETAIL_ALIASES: Record<string, string[]> = {
  month: ["month"],
  date: ["date"],
  description: ["particulars", "description"],
  costCentre: ["level iii cost centre", "level iii"],
  head: ["account head"],
  country: ["country"],
  amount: ["us$", "usd", "amount usd"],
};
const MONTHLY_TAB_ALIASES: Record<string, string[]> = {
  date: ["date"],
  description: ["particulars", "description"],
  costCentre: ["level iii", "level iii cost centre"],
  head: ["account head"],
  country: ["country"],
  amount: ["us$", "usd", "amount usd"],
};

function rowToArray(row: ExcelJS.Row): unknown[] {
  const values: unknown[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    values[colNumber - 1] = cell.value;
  });
  return values;
}

function headerIndex(headerRow: unknown[], aliases: Record<string, string[]>): Record<string, number | null> {
  const normalizedHeader = headerRow.map((h) => normal(h));
  const idx: Record<string, number | null> = {};
  for (const [key, variants] of Object.entries(aliases)) {
    idx[key] = normalizedHeader.findIndex((h) => variants.includes(h));
    if (idx[key] === -1) idx[key] = null;
  }
  return idx;
}

export type MonthlyFigures = {
  month: string;
  collectionsPrior: number | null;
  collectionsPlan: number | null;
  collections: number | null;
  salesPlan: number | null;
  opexBudget: number | null;
};

export type ParseStats = {
  sheets: string[];
  invalidRows: string[];
  mode: string;
  monthlyData: MonthlyFigures[];
};

/** Direct port of parse_file(). */
export function parseLedgerWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): { rows: Omit<ParsedLedgerRow, "occurrence">[]; stats: ParseStats } {
  const stats: ParseStats = { sheets: [], invalidRows: [], mode: "", monthlyData: [] };
  const raw: Omit<ParsedLedgerRow, "occurrence">[] = [];

  const sheetByNormalizedName = new Map<string, ExcelJS.Worksheet>();
  for (const ws of workbook.worksheets) sheetByNormalizedName.set(normal(ws.name), ws);

  const detailSheet = sheetByNormalizedName.get("cost centre detail");
  if (detailSheet) {
    const headerRow = rowToArray(detailSheet.getRow(1));
    const idx = headerIndex(headerRow, COST_CENTRE_DETAIL_ALIASES);
    if (idx.month === null || idx.description === null || idx.amount === null) {
      throw new Error("Cost Centre Detail sheet does not match the expected headers.");
    }
    const normalizedHeader = headerRow.map((h) => normal(h));
    const ssIdx = normalizedHeader.indexOf("source sheet");
    const srIdx = normalizedHeader.indexOf("source row");

    for (let r = 2; r <= detailSheet.rowCount; r++) {
      const vals = rowToArray(detailSheet.getRow(r));
      if (vals.length === 0 || vals.every((v) => v === null || v === undefined)) continue;
      const get = (key: string) => (idx[key] !== null ? vals[idx[key] as number] : undefined);
      const t = makeTx(
        {
          month: get("month"),
          date: get("date"),
          description: get("description"),
          costCentre: get("costCentre"),
          head: get("head"),
          country: get("country"),
          amount: get("amount"),
          sourceSheet: ssIdx >= 0 ? vals[ssIdx] : detailSheet.name,
          sourceRow: srIdx >= 0 ? vals[srIdx] : r,
        },
        filename
      );
      if (t) raw.push(t);
      else stats.invalidRows.push(`${detailSheet.name}, row ${r}`);
    }
    stats.sheets.push(detailSheet.name);
    stats.mode = "consolidated Cost Centre Detail";
  }

  // Also accept monthly tabs not yet reflected in the consolidated detail.
  const detailMonths = new Set(raw.map((t) => t.month));
  for (const ws of workbook.worksheets) {
    if (!/(marketing|sales\s*&\s*m\.?\s*oh|sales.*oh)/i.test(ws.name)) continue;
    if (/comm(?:ission)?\s*$/i.test(ws.name)) continue;
    const m = ym(ws.name);
    if (!m || detailMonths.has(m)) continue;

    const headerRow = rowToArray(ws.getRow(1));
    if (headerRow.length === 0) continue;
    const idx = headerIndex(headerRow, MONTHLY_TAB_ALIASES);
    if (idx.date === null || idx.description === null || idx.amount === null) continue;

    stats.sheets.push(ws.name);
    for (let r = 2; r <= ws.rowCount; r++) {
      const vals = rowToArray(ws.getRow(r));
      const v = (key: string) => (idx[key] !== null ? vals[idx[key] as number] : undefined);
      if (!v("description") || numeric(v("amount")) === null) continue;
      const t = makeTx(
        {
          month: m,
          date: v("date"),
          description: v("description"),
          costCentre: v("costCentre"),
          head: v("head"),
          country: v("country"),
          amount: v("amount"),
          sourceSheet: ws.name,
          sourceRow: r,
        },
        filename
      );
      if (t) raw.push(t);
      else stats.invalidRows.push(`${ws.name}, row ${r}`);
    }
  }
  stats.mode = detailMonths.size > 0 ? "Cost Centre Detail plus new monthly tabs" : "monthly Sales/Marketing tabs";

  if (raw.length === 0) {
    throw new Error("No compatible payment rows were found. Please upload the same One Homes cost centre detail or monthly sheet format.");
  }

  const perfSheet = sheetByNormalizedName.get("monthly performance");
  if (perfSheet) {
    for (let r = 1; r <= perfSheet.rowCount; r++) {
      const vals = rowToArray(perfSheet.getRow(r));
      const month = ym(vals[0]);
      if (!month) continue;
      stats.monthlyData.push({
        month,
        collectionsPrior: numeric(vals[1]),
        collectionsPlan: numeric(vals[2]),
        collections: numeric(vals[3]),
        salesPlan: numeric(vals[4]),
        opexBudget: numeric(vals[18]),
      });
    }
  }

  return { rows: raw, stats };
}

export type ImportPreviewResult = {
  filename: string;
  rowsChecked: number;
  newPayments: number;
  alreadyInSql: number;
  invalidRows: number;
  newAmountUsd: number;
  monthsAdded: string[];
  sheets: string[];
  mode: string;
  newHeads: { head: string; centre: string }[];
  sampleNewPayments: { month: string; date: string; description: string; amountUsd: number; head: string }[];
  warning: string;
  newRows: ParsedLedgerRow[];
  monthlyData: MonthlyFigures[];
};

const MAX_PREVIEW_ROWS = 20000;

/**
 * Direct port of preview_import(). Must run inside withTenant() so the
 * FinanceTransaction read below is correctly scoped to the calling
 * organization (the Prisma extension injects organizationId automatically).
 */
export async function previewLedgerImport(buffer: Buffer, filename: string): Promise<ImportPreviewResult> {
  if (!filename.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Upload an Excel .xlsx file in the existing One Homes format.");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Excel file is too large (25 MB maximum).");
  }
  if (buffer.subarray(0, 2).toString("latin1") !== "PK") {
    throw new Error("Invalid .xlsx file.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const { rows: raw, stats } = parseLedgerWorkbook(workbook, filename);
  if (raw.length > MAX_PREVIEW_ROWS) {
    throw new Error(`This workbook has ${raw.length.toLocaleString()} payment rows — narrow it to ${MAX_PREVIEW_ROWS.toLocaleString()} or fewer per upload.`);
  }

  const existing = await prisma.financeTransaction.groupBy({
    by: ["fingerprint"],
    _count: true,
  });
  const existingCounts = new Map(existing.map((e) => [e.fingerprint, e._count]));
  const existingHeads = new Set(
    (await prisma.financeCostHead.findMany({ select: { head: true, centre: true } })).map((h) => `${h.head}\u0000${h.centre}`)
  );

  const seen = new Map<string, number>();
  const newRows: ParsedLedgerRow[] = [];
  let duplicateCount = 0;
  const newMonths = new Set<string>();
  const newHeadsSet = new Set<string>();

  for (const t of raw) {
    const idx = seen.get(t.fingerprint) ?? 0;
    seen.set(t.fingerprint, idx + 1);
    const existingCount = existingCounts.get(t.fingerprint) ?? 0;
    if (idx < existingCount) {
      duplicateCount++;
    } else {
      newRows.push({ ...t, occurrence: idx });
      newMonths.add(t.month);
      const key = `${t.head}\u0000${t.costCentre}`;
      if (!existingHeads.has(key)) newHeadsSet.add(key);
    }
  }

  return {
    filename,
    rowsChecked: raw.length,
    newPayments: newRows.length,
    alreadyInSql: duplicateCount,
    invalidRows: stats.invalidRows.length,
    newAmountUsd: Math.round(newRows.reduce((s, t) => s + t.amount, 0) * 100) / 100,
    monthsAdded: Array.from(newMonths).sort(),
    sheets: stats.sheets,
    mode: stats.mode,
    newHeads: Array.from(newHeadsSet)
      .sort()
      .map((k) => {
        const [head, centre] = k.split("\u0000");
        return { head, centre };
      }),
    sampleNewPayments: newRows.slice(0, 12).map((t) => ({
      month: t.month,
      date: t.date,
      description: t.description,
      amountUsd: t.amount,
      head: t.head,
    })),
    warning:
      "Matching uses date, description, amount and country. Identical real payments may require manual investigation. Repeated uploads are safe.",
    newRows,
    monthlyData: stats.monthlyData,
  };
}

export type CommitImportResult = { ok: true; importId: string; added: number; addedAmount: number };

/**
 * Direct port of commit_import(). `newRows`/`monthlyData` are exactly what
 * previewLedgerImport() returned — the client sends them back unchanged
 * (see this file's top comment on why there's no server-side preview
 * token/session here).
 */
export async function commitLedgerImport(params: {
  filename: string;
  mode: string;
  sheets: string[];
  newRows: ParsedLedgerRow[];
  monthlyData: MonthlyFigures[];
}): Promise<CommitImportResult> {
  const { filename, newRows, monthlyData } = params;
  if (!Array.isArray(newRows) || newRows.length === 0) {
    throw new Error("Nothing to add — re-check the file first.");
  }
  if (newRows.length > MAX_PREVIEW_ROWS) {
    throw new Error("Too many rows in this commit — re-check the file first.");
  }

  // Recompute current occurrence counts fresh (not trusting the possibly
  // stale preview) so a second import committed in between can't collide
  // with this one — same safety the source's commit_import() applies.
  const existing = await prisma.financeTransaction.groupBy({ by: ["fingerprint"], _count: true });
  const counts = new Map(existing.map((e) => [e.fingerprint, e._count]));

  let total = 0;
  let added = 0;
  for (const t of newRows) {
    const occ = Math.max(t.occurrence, counts.get(t.fingerprint) ?? 0);
    counts.set(t.fingerprint, occ + 1);
    await prisma.financeTransaction.create({
      data: {
        fingerprint: t.fingerprint,
        occurrence: occ,
        month: t.month,
        paymentDate: t.date ? new Date(t.date) : new Date(`${t.month}-01`),
        description: t.description,
        originalCentre: t.costCentre,
        originalHead: t.head,
        country: t.country,
        amountUsd: t.amount,
        sourceSheet: t.sourceSheet || null,
        sourceRow: t.sourceRow || null,
        sourceFile: t.sourceFile,
        reviewGroup: t.reviewGroup,
      },
    });
    total += t.amount;
    added++;
  }

  // Monthly figures only fill gaps — never overwrite a value Finance
  // already entered manually, matching the source's COALESCE behaviour.
  for (const m of monthlyData) {
    const existingMonth = await prisma.financeMonthly.findFirst({ where: { month: m.month } });
    if (existingMonth) {
      await prisma.financeMonthly.update({
        where: { id: existingMonth.id },
        data: {
          collections: existingMonth.collections || m.collections || 0,
          collectionsPrior: existingMonth.collectionsPrior || m.collectionsPrior || 0,
          collectionsPlan: existingMonth.collectionsPlan || m.collectionsPlan || 0,
          salesPlan: existingMonth.salesPlan || m.salesPlan || 0,
          opexBudget: existingMonth.opexBudget || m.opexBudget || 0,
        },
      });
    } else {
      await prisma.financeMonthly.create({
        data: {
          month: m.month,
          collections: m.collections ?? 0,
          collectionsPrior: m.collectionsPrior ?? 0,
          collectionsPlan: m.collectionsPlan ?? 0,
          salesPlan: m.salesPlan ?? 0,
          opexBudget: m.opexBudget ?? 0,
        },
      });
    }
  }

  const importRow = await prisma.financeImport.create({
    data: {
      filename,
      addedCount: added,
      skippedCount: 0,
      invalidCount: 0,
      addedAmount: Math.round(total * 100) / 100,
      detailsJson: JSON.stringify({ mode: params.mode, sheets: params.sheets }),
    },
  });

  return { ok: true, importId: importRow.id, added, addedAmount: Math.round(total * 100) / 100 };
}
