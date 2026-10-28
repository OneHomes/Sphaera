import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getDepartmentCatalogue } from "@/lib/finance/payrollData";
import { savePerson } from "@/lib/finance/peopleOverheadsData";

// Port of v41 people_costs.py template() / parse_excel() / import_rows(): the employee roster
// workbook. It creates or updates People records only and never touches a payment.

export const PEOPLE_HEADERS = ["Employee ID", "Full Name", "Department", "Job Title", "Email", "Payment Alias", "Active"] as const;

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
};

const namekey = (s: unknown) => String(s ?? "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const safe = (v: unknown, n = 200) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text ?? "").trim().slice(0, n);
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "").trim().slice(0, n);
  return String(v).trim().slice(0, n);
};

export async function peopleTemplate(): Promise<Buffer> {
  const departments = await getDepartmentCatalogue();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sphaera";
  const ws = wb.addWorksheet("People", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow([...PEOPLE_HEADERS]);
  ws.addRow(["", "Example Employee", departments.includes("Sales") ? "Sales" : departments[0] ?? "", "Sales Consultant", "example@onehomes.com", "Example Employee", "Yes"]);
  ws.autoFilter = "A1:G501";
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
    "Replace the example row before upload.",
    "Employee ID: leave blank for new staff; use an existing ID to update.",
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
  for (let r = 2; r <= 501; r++) {
    if (departments.length) {
      ws.getCell(`C${r}`).dataValidation = { type: "list", allowBlank: false, formulae: ["ApprovedDepartments"], showErrorMessage: true, errorStyle: "stop", errorTitle: "Unapproved department", error: "Select a department from the approved list." };
    }
    ws.getCell(`G${r}`).dataValidation = { type: "list", allowBlank: false, formulae: ['"Yes,No"'], showErrorMessage: true, errorStyle: "stop" };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Validates every roster row exactly like the source parse_excel(); returns rows with per-row errors. */
export async function parsePeopleWorkbook(buf: ArrayBuffer): Promise<PeopleImportRow[]> {
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

  const [catalogue, people] = await Promise.all([
    getDepartmentCatalogue(),
    prisma.financePerson.findMany({ select: { id: true, fullName: true, department: true, email: true } }),
  ]);
  const approved = new Map(catalogue.map((d) => [namekey(d), d]));
  const existing = new Map(people.map((p) => [p.id, p]));
  const byEmail = new Map(people.filter((p) => p.email).map((p) => [namekey(p.email), p]));
  const seen = new Set<string>();
  const rows: PeopleImportRow[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const entry = PEOPLE_HEADERS.map((_, i) => safe(row.getCell(i + 1).value));
    if (!entry.some(Boolean)) continue;
    if (r > 2002) throw new Error("Maximum 2,000 employees per import");
    const [rawId, name, rawDept, jobTitle, rawEmail, alias, rawActive] = entry;
    const department = approved.get(namekey(rawDept));
    const email = rawEmail.toLowerCase();
    let ident = rawId;
    const errors: string[] = [];
    if (!name || name.length < 2 || name.startsWith("=")) errors.push("Full Name is required");
    if (!department) errors.push("Department must match an approved department");
    if (!jobTitle) errors.push("Job Title is required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email address");
    if (ident && !existing.has(ident)) errors.push("Unknown Employee ID; leave blank for a new employee");
    const emailOwner = email ? byEmail.get(namekey(email)) : undefined;
    if (ident && emailOwner && emailOwner.id !== ident) errors.push("Email belongs to another employee");
    if (!ident && emailOwner) ident = emailOwner.id;
    if (!ident && !email) {
      const matches = people.filter((p) => namekey(p.fullName) === namekey(name) && namekey(p.department) === namekey(department));
      if (matches.length === 1) ident = matches[0].id;
      if (matches.length > 1) errors.push("Ambiguous existing name; use Employee ID");
    }
    const key = ident || `new:${namekey(email || `${name}|${department ?? ""}`)}`;
    if (seen.has(key)) errors.push("Duplicate employee within workbook");
    seen.add(key);
    const active = rawActive.toLowerCase();
    if (!["yes", "no", "true", "false", "active", "inactive", "1", "0", ""].includes(active)) errors.push("Active must be Yes or No");
    rows.push({
      row: r,
      id: ident,
      full_name: name,
      department: department ?? rawDept,
      job_title: jobTitle,
      email,
      payment_alias: alias,
      active: !["no", "false", "inactive", "0"].includes(active),
      status: errors.length ? "Error" : ident ? "Update" : "Add",
      errors,
    });
  }
  if (!rows.length) throw new Error("Excel has no employee rows");
  return rows;
}

/** Commit: re-parse the uploaded workbook server-side (never trust client rows) and save each person. */
export async function importPeople(buf: ArrayBuffer, actor: { id: string; email: string }) {
  const rows = await parsePeopleWorkbook(buf);
  if (rows.some((r) => r.errors.length)) throw new Error("Resolve all Excel errors before importing");
  let added = 0;
  let updated = 0;
  for (const r of rows) {
    const result = await savePerson({
      id: r.id || undefined,
      name: r.full_name,
      department: r.department,
      jobTitle: r.job_title,
      email: r.email,
      paymentAlias: r.payment_alias,
      active: r.active,
      actorId: actor.id,
      actorEmail: actor.email,
    });
    if (!result.ok) throw new Error(`Row ${r.row}: ${result.error} (${added + updated} earlier rows were saved)`);
    if (r.id) updated++;
    else added++;
  }
  return { ok: true as const, added, updated, total: rows.length };
}
