// Shared between the HubSpot sync paths (lib/hubspotSync.ts,
// lib/hubspotBulkImport.ts, and the real-time webhook) so the exclusion
// rule — confirmed 2026-10-14 — lives in exactly one place rather than
// drifting across copies.

export const EXCLUDED_DOMAINS = [
  "oneg.com",
  "oneinvestment.com",
  "onegroup.com",
  "elevate.com",
  "sakari.email",
  "hubspot.com",
  "onehomes.com",
];
export const DEMO_CONTACT_SOURCE_LABEL = "INTERNAL_PROCESSING"; // HubSpot's own built-in sample contacts

export const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "leadsource",
  "leadstatus",
  "project__c",
  "salesforceleadid",
  "hubspot_owner_id",
  "lastmodifieddate",
  "createdate",
  "estimated_value__c",
  "closed_value_all_project",
  "closing_date__c",
  "closed_date_all_project",
  "hs_object_source_label",
];

export function truthy(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function fullName(p: Record<string, string | null>): string {
  return [p.firstname, p.lastname].filter(Boolean).join(" ").trim() || "Unknown";
}

export function parseNumber(v: string | null | undefined): number | null {
  if (!truthy(v)) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function realDealValue(p: Record<string, string | null>): number | null {
  return parseNumber(p.closed_value_all_project) ?? parseNumber(p.estimated_value__c);
}

export function realDealCloseDate(p: Record<string, string | null>): Date | null {
  const raw = p.closed_date_all_project || p.closing_date__c;
  return truthy(raw) ? new Date(raw) : null;
}

function emailDomain(email: string | null | undefined): string | null {
  if (!truthy(email) || !email.includes("@")) return null;
  return email.split("@").pop()!.toLowerCase();
}

/**
 * True if this contact should never become a Sphaera lead — internal/
 * vendor/tool domains (not real clients), anything with "test" in the
 * name or email, or missing any one of name/email/phone (per direct
 * instruction, 2026-10-14: a lead with any of those three blank must
 * never sync, now or in the future).
 */
export function isExcludedContact(p: Record<string, string | null>): boolean {
  if (p.hs_object_source_label === DEMO_CONTACT_SOURCE_LABEL) return true;
  const domain = emailDomain(p.email);
  if (domain && EXCLUDED_DOMAINS.includes(domain)) return true;
  const haystack = `${p.email ?? ""} ${p.firstname ?? ""} ${p.lastname ?? ""}`.toLowerCase();
  if (haystack.includes("test")) return true;

  const hasName = truthy(p.firstname) || truthy(p.lastname);
  const hasEmail = truthy(p.email);
  const hasPhone = truthy(p.phone) || truthy(p.mobilephone);
  if (!hasName || !hasEmail || !hasPhone) return true;

  return false;
}
