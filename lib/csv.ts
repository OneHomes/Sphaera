import { NextResponse } from "next/server";

// Excel-compatible: quotes every field, doubles embedded quotes, and
// prefixes with a UTF-8 BOM so accented/special characters and
// thousand-separated numbers don't get mangled on open.
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

// Client-side: builds a CSV from already-fetched/filtered rows (whatever
// the user currently sees in the table) and triggers a browser download.
// Used by LeadInbox and AdminUsersPage's Governance Log.
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csv =
    "﻿" +
    [headers, ...rows]
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Server-side (PRD PF07 "export audit events" + Apex Vision "Reporting
// and export"): builds the full CSV text for a Route Handler to return,
// uncapped by whatever pagination the JSON view uses.
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","))
    .join("\n");
  return "﻿" + [header, body].filter(Boolean).join("\n");
}

export function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
