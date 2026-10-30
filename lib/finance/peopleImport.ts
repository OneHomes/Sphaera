import ExcelJS from "exceljs";
import { prisma, tenantContext } from "@/lib/prisma";
import { getDepartmentCatalogue } from "@/lib/finance/payrollData";

// Port of v41 people_costs.py template() / parse_excel() / import_rows(): the employee roster
// workbook. It creates or updates People records only and never touches a payment.

export const PEOPLE_HEADERS = ["Employee ID", "Full Name", "Department", "Job Title", "Email", "Payment Alias", "Active"] as const;

/** One roster row as typed (from the workbook, or as corrected on the preview screen). */
export type PeopleRawRow = {
  row: number;
  id: string;
  full_name: string;
  department: string;
  job_title: string;
  email: string;
  payment_alias: string;
  active: string;
};

export type PeopleImportRow = {
  row: number;
  id: string;
  full_name: string;
  department: string;
  job_title: string;
  email: string;
  payment_alias: string;
  active: boolean;
  status: "Add" | "Update" | "Error";
  errors: string[];
  // Safe automatic corrections already applied to this row (shown, never blocking).
  warnings: string[];
  // Other rows using the same email, so the preview can ask who it belongs to.
  emailConflictRows: number[];
};

const MAX_ROWS = 2000;

const namekey = (s: unknown) => String(s ?? "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const safe = (v: unknown, n = 200) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text ?? "").trim().slice(0, n);
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "").trim().slice(0, n);
  return String(v).trim().slice(0, n);
};

export async function peopleTemplate(): Promise<Buffer> {
  const [departments, people] = await Promise.all([
    getDepartmentCatalogue(),
    prisma.financePerson.findMany({
      select: { id: true, fullName: true, department: true, jobTitle: true, email: true, paymentAlias: true, active: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sphaera";
  const ws = wb.addWorksheet("People", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow([...PEOPLE_HEADERS]);
  // The roster is the only way to add or edit employees, so the template carries every current
  // record with its ID: edit a row to update it, add a row with a blank ID for new staff.
  if (people.length) {
    for (const p of people) ws.addRow([p.id, p.fullName, p.department ?? "", p.jobTitle, p.email, p.paymentAlias, p.active ? "Yes" : "No"]);
  } else {
    ws.addRow(["", "Example Employee", departments.includes("Sales") ? "Sales" : departments[0] ?? "", "Sales Consultant", "example@onehomes.com", "Example Employee", "Yes"]);
  }
  const lastRow = Math.min(2000, Math.max(501, people.length + 501));
  ws.autoFilter = `A1:G${lastRow}`;
  [38, 30, 28, 31, 37, 35, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF252525" } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { vertical: "middle" };
  });
  ws.getRow(1).height = 30;
  ws.getCell("I2").value = "Instructions";
  ws.getCell("I2").font = { bold: true };
  [
    people.length ? "Current employees are listed. Edit a row to update that employee." : "Replace the example row before upload.",
    "Employee ID: leave blank for new staff; do not change the ID of an existing row.",
    "Department must be selected from the approved dropdown.",
    "Job Title and Payment Alias help identify the cost correctly.",
    "Payment Alias is the name printed on bank / ERP payment descriptions.",
    "Active: Yes or No. Upload previews changes before any save.",
    "This workbook does not create or modify any bank payment.",
  ].forEach((t, i) => (ws.getCell(3 + i, 9).value = t));
  ws.getColumn(9).width = 100;

  const lists = wb.addWorksheet("Approved Departments", { state: "hidden" });
  lists.addRow(["Approved departments"]);
  departments.forEach((d) => lists.addRow([d]));
  if (departments.length) {
    wb.definedNames.add(`'Approved Departments'!$A$2:$A$${departments.length + 1}`, "ApprovedDepartments");
  }
  for (let r = 2; r <= lastRow; r++) {
    if (departments.length) {
      ws.getCell(`C${r}`).dataValidation = { type: "list", allowBlank: false, formulae: ["ApprovedDepartments"], showErrorMessage: true, errorStyle: "stop", errorTitle: "Unapproved department", error: "Select a department from the approved list." };
    }
    ws.getCell(`G${r}`).dataValidation = { type: "list", allowBlank: false, formulae: ['"Yes,No"'], showErrorMessage: true, errorStyle: "stop" };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const alnum = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_VALUES = ["yes", "no", "true", "false", "active", "inactive", "1", "0", "y", "n", ""];

// Common short forms finance teams type for the approved departments.
const DEPARTMENT_ALIASES: Record<string, string> = {
  revops: "Revenue Operations",
  hr: "Human Resources",
  people: "Human Resources",
  it: "Information Technology",
  tech: "Information Technology",
  dev: "Development",
  exec: "Executive Expenditure",
  executive: "Executive Expenditure",
  ops: "Operations",
  fin: "Finance",
  accounts: "Finance",
  mkt: "Marketing",
  mktg: "Marketing",
};

/**
 * Reads a typed department as an approved one: exact name, a known short form, the same
 * letters ignoring spaces/punctuation/"dept", or the single approved name that contains it.
 * Returns null when nothing (or more than one department) fits, so it is never a guess.
 */
export function resolveDepartment(raw: string, catalogue: string[]): string | null {
  const typed = tidy(raw);
  if (!typed) return null;
  const exact = catalogue.find((d) => namekey(d) === namekey(typed));
  if (exact) return exact;
  const stripped = alnum(typed).replace(/(department|dept|team)$/, "");
  if (!stripped) return null;
  const alias = DEPARTMENT_ALIASES[stripped];
  if (alias && catalogue.includes(alias)) return alias;
  const same = catalogue.filter((d) => alnum(d) === stripped);
  if (same.length === 1) return same[0];
  if (stripped.length < 3) return null;
  const containing = catalogue.filter((d) => alnum(d).includes(stripped) || stripped.includes(alnum(d)));
  return containing.length === 1 ? containing[0] : null;
}

/** Reads the roster workbook into raw rows (file and header checks only). */
export async function readPeopleWorkbook(buf: ArrayBuffer): Promise<PeopleRawRow[]> {
  if (buf.byteLength > 8 * 1024 * 1024) throw new Error("Employee workbook exceeds 8 MB");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new Error("Upload a valid .xlsx employee workbook");
  }
  const ws = wb.getWorksheet("People") ?? wb.worksheets[0];
  if (!ws) throw new Error("Upload a valid .xlsx employee workbook");
  const headers = PEOPLE_HEADERS.map((_, i) => safe(ws.getRow(1).getCell(i + 1).value));
  if (headers.join("|") !== PEOPLE_HEADERS.join("|")) {
    throw new Error("Wrong template columns. Download the People Costs template and use its headings.");
  }
  const rows: PeopleRawRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const entry = PEOPLE_HEADERS.map((_, i) => safe(row.getCell(i + 1).value));
    if (!entry.some(Boolean)) continue;
    if (r > MAX_ROWS + 2) throw new Error("Maximum 2,000 employees per import");
    const [id, full_name, department, job_title, email, payment_alias, active] = entry;
    rows.push({ row: r, id, full_name, department, job_title, email, payment_alias, active });
  }
  if (!rows.length) throw new Error("Excel has no employee rows");
  return rows;
}

/** Coerces untrusted JSON (rows corrected on the preview screen) into raw rows. */
export function rawRowsFromJson(input: unknown): PeopleRawRow[] {
  if (!Array.isArray(input) || !input.length) throw new Error("No employee rows to check");
  if (input.length > MAX_ROWS) throw new Error("Maximum 2,000 employees per import");
  return input.map((x, i) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const s = (k: string, n = 200) => String(o[k] ?? "").slice(0, n);
    const row = Number(o.row);
    return {
      row: Number.isInteger(row) && row > 0 ? row : i + 2,
      id: s("id", 64),
      full_name: s("full_name"),
      department: s("department"),
      job_title: s("job_title"),
      email: s("email"),
      payment_alias: s("payment_alias"),
      active: s("active", 20),
    };
  });
}

/**
 * Validates roster rows like the source parse_excel(), after applying only safe corrections
 * (each reported as a warning): tidy spacing, drop an email that is not an address (email is
 * optional), and read near-miss department names as the approved one. Anything that needs a
 * person's decision (missing department, one email on two people) stays an error.
 */
export async function validatePeopleRows(input: PeopleRawRow[]): Promise<PeopleImportRow[]> {
  const [catalogue, people] = await Promise.all([
    getDepartmentCatalogue(),
    prisma.financePerson.findMany({ select: { id: true, fullName: true, department: true, email: true } }),
  ]);
  const existing = new Map(people.map((p) => [p.id, p]));
  const byEmail = new Map(people.filter((p) => p.email).map((p) => [namekey(p.email), p]));

  // Pass 1: safe corrections.
  const prepared = input.map((raw) => {
    const warnings: string[] = [];
    const name = tidy(raw.full_name);
    const jobTitle = tidy(raw.job_title);
    const alias = tidy(raw.payment_alias);
    let email = raw.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      warnings.push(`Email "${raw.email.trim()}" is not an email address, so it was left blank`);
      email = "";
    }
    const rawDept = tidy(raw.department);
    const department = resolveDepartment(rawDept, catalogue);
    if (department && namekey(department) !== namekey(rawDept)) warnings.push(`Department "${rawDept}" read as "${department}"`);
    return { raw, name, jobTitle, alias, email, rawDept, department, warnings };
  });

  // Emails used by more than one row in this upload.
  const emailRows = new Map<string, number[]>();
  for (const p of prepared) if (p.email) emailRows.set(p.email, [...(emailRows.get(p.email) ?? []), p.raw.row]);

  // Pass 2: validation, exactly the source's rules.
  const seen = new Set<string>();
  return prepared.map(({ raw, name, jobTitle, alias, email, rawDept, department, warnings }) => {
    const errors: string[] = [];
    const rawId = raw.id.trim();
    let ident = rawId;
    const sharing = (email ? emailRows.get(email) ?? [] : []).filter((r) => r !== raw.row);
    if (!name || name.length < 2 || name.startsWith("=")) errors.push("Full Name is required");
    if (!rawId && namekey(name) === "example employee") errors.push("Replace the example row with a real employee");
    if (!department) errors.push(rawDept ? `Department "${rawDept}" is not an approved department` : "Department is missing");
    if (!jobTitle) errors.push("Job Title is required");
    if (sharing.length) errors.push(`Same email as row ${sharing.join(", ")}; choose who it belongs to`);
    if (ident && !existing.has(ident)) errors.push("Unknown Employee ID; leave blank for a new employee");
    const emailOwner = email ? byEmail.get(namekey(email)) : undefined;
    if (ident && emailOwner && emailOwner.id !== ident) errors.push("Email belongs to another employee");
    if (!ident && emailOwner && !sharing.length) ident = emailOwner.id;
    // No ID and no email owner: the same name + department is the same person (an email typed
    // now is added to them), unless that record already has a different email.
    if (!ident) {
      const matches = people.filter(
        (p) => namekey(p.fullName) === namekey(name) && namekey(p.department) === namekey(department) && (!p.email || !email || namekey(p.email) === namekey(email))
      );
      if (matches.length === 1) ident = matches[0].id;
      if (matches.length > 1) errors.push("Ambiguous existing name; use Employee ID");
    }
    const key = ident || `new:${namekey(sharing.length ? `${name}|${department ?? ""}` : email || `${name}|${department ?? ""}`)}`;
    if (seen.has(key)) errors.push("Duplicate employee within workbook");
    seen.add(key);
    const active = raw.active.trim().toLowerCase();
    if (!ACTIVE_VALUES.includes(active)) errors.push("Active must be Yes or No");
    return {
      row: raw.row,
      id: ident,
      full_name: name,
      department: department ?? rawDept,
      job_title: jobTitle,
      email,
      payment_alias: alias,
      active: !["no", "false", "inactive", "0", "n"].includes(active),
      status: errors.length ? "Error" : ident ? "Update" : "Add",
      errors,
      warnings,
      emailConflictRows: sharing,
    };
  });
}

/** Reads and validates a roster workbook (preview). */
export async function parsePeopleWorkbook(buf: ArrayBuffer): Promise<PeopleImportRow[]> {
  return validatePeopleRows(await readPeopleWorkbook(buf));
}

/**
 * Commit: re-validates the rows server-side (never trusts the preview result), then saves them
 * all in ONE transaction that holds an import lock for the organization. Inside the lock every
 * new row is matched again against the people saved so far (email, else name + department), so
 * a second click or a second upload running at the same time updates people instead of
 * creating duplicates. Unchanged people are skipped and new ones are inserted in one batch.
 */
export async function importPeople(input: PeopleRawRow[]) {
  const rows = await validatePeopleRows(input);
  if (rows.some((r) => r.errors.length)) throw new Error("Resolve all errors before importing");
  const org = tenantContext.getStore()?.organizationId ?? "default";

  return prisma.$transaction(
    async (tx) => {
      // Serializes imports per organization until this transaction ends (SQL Server app lock).
      const lock = await tx.$queryRawUnsafe<{ r: number }[]>(
        "DECLARE @r int; EXEC @r = sp_getapplock @Resource = @P1, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 60000; SELECT @r AS r;",
        `finance-people-import:${org}`
      );
      if (!lock[0] || lock[0].r < 0) throw new Error("Another employee import is still running. Try again in a minute.");

      const existing = await tx.financePerson.findMany({
        select: { id: true, fullName: true, department: true, jobTitle: true, email: true, paymentAlias: true, active: true },
      });
      const byId = new Map(existing.map((p) => [p.id, p]));
      const byEmail = new Map(existing.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
      const byNameDept = new Map<string, (typeof existing)[number][]>();
      for (const p of existing) {
        const k = `${namekey(p.fullName)}|${namekey(p.department)}`;
        byNameDept.set(k, [...(byNameDept.get(k) ?? []), p]);
      }

      const creates: { fullName: string; department: string; jobTitle: string; email: string; paymentAlias: string; active: boolean }[] = [];
      const seenNew = new Set<string>();
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      for (const r of rows) {
        const data = { fullName: r.full_name, department: r.department, jobTitle: r.job_title, email: r.email, paymentAlias: r.payment_alias, active: r.active };
        const nameKey = `${namekey(r.full_name)}|${namekey(r.department)}`;
        const sameName = (byNameDept.get(nameKey) ?? []).filter((p) => !p.email || !r.email || p.email.toLowerCase() === r.email);
        const match =
          (r.id && byId.get(r.id)) ||
          (r.email && byEmail.get(r.email)) ||
          (sameName.length === 1 ? sameName[0] : undefined);
        if (match) {
          if (r.email && byEmail.get(r.email) && byEmail.get(r.email)!.id !== match.id) {
            throw new Error(`Row ${r.row}: that email is already assigned to another employee. Nothing was saved.`);
          }
          const same =
            match.fullName === data.fullName && match.department === data.department && match.jobTitle === data.jobTitle &&
            match.email === data.email && match.paymentAlias === data.paymentAlias && match.active === data.active;
          if (same) unchanged++;
          else {
            await tx.financePerson.update({ where: { id: match.id }, data });
            updated++;
          }
          continue;
        }
        const newKey = r.email ? `e:${r.email}` : `n:${nameKey}`;
        if (seenNew.has(newKey)) continue; // same new person twice in one file
        seenNew.add(newKey);
        creates.push(data);
        added++;
      }
      if (creates.length) await tx.financePerson.createMany({ data: creates });
      return { ok: true as const, added, updated, unchanged, total: rows.length };
    },
    { timeout: 120000, maxWait: 30000 }
  );
}
