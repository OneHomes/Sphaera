// Real data now comes from the Document table + Azure Blob Storage (see
// app/(app)/documents/page.tsx and app/api/documents/) — the mock array
// that used to live here has been removed. This file holds the shared
// types plus formatting helpers.

import type { Document as PrismaDocument, User } from "@prisma/client";
import { formatRelativeTime } from "./leadTransform";

export const DOC_TYPES = [
  "Brochure",
  "Price List",
  "Payment Plan",
  "Contract",
  "Proposal",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export type SphaeraDocument = {
  id: string;
  name: string;
  type: DocType;
  relatedTo: string;
  uploadedDate: string;
  uploadedBy: string;
  sizeLabel: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toUiDocument(
  row: PrismaDocument & { uploadedBy: User }
): SphaeraDocument {
  return {
    id: row.id,
    name: row.name,
    type: row.docType as DocType,
    relatedTo: row.relatedTo ?? "—",
    uploadedDate: formatRelativeTime(row.createdAt),
    uploadedBy: row.uploadedBy.name,
    sizeLabel: formatFileSize(row.sizeBytes),
  };
}
