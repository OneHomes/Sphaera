// HubSpot's "Original Source" for a contact, worded the way HubSpot's own
// timeline does ("This contact was created from Offline Sources from Sales
// Extension"). Raw values come from hs_analytics_source and
// hs_analytics_source_data_1, stored on Lead.originalSource /
// Lead.originalSourceDetail by every HubSpot sync path.

export const ORIGINAL_SOURCE_PROPERTIES = ["hs_analytics_source", "hs_analytics_source_data_1"] as const;

const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "Organic Search",
  PAID_SEARCH: "Paid Search",
  EMAIL_MARKETING: "Email Marketing",
  SOCIAL_MEDIA: "Organic Social",
  PAID_SOCIAL: "Paid Social",
  REFERRALS: "Referrals",
  AI_REFERRALS: "AI Referrals",
  OTHER_CAMPAIGNS: "Other Campaigns",
  DIRECT_TRAFFIC: "Direct Traffic",
  OFFLINE: "Offline Sources",
};

// Drill-down values HubSpot uses for Offline Sources (the record-creation
// channel); other sources' drill-downs are free text (a search engine,
// campaign or referring site) and are shown as stored.
const OFFLINE_DETAIL_LABELS: Record<string, string> = {
  EXTENSION: "Sales Extension",
  CRM_UI: "CRM UI",
  IMPORT: "Import",
  API: "API",
  INTEGRATION: "Integration",
  EMAIL: "Email",
  FORM: "Form",
  MOBILE_IOS: "Mobile (iOS)",
  MOBILE_ANDROID: "Mobile (Android)",
  CONVERSATIONS: "Conversations",
  BCC_TO_CRM: "BCC to CRM",
  FORWARD_TO_CRM: "Forward to CRM",
  SALES_MESSAGES: "Sales Messages",
  MEETINGS: "Meetings",
  AUTOMATION_PLATFORM: "Workflows",
};

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** "Offline Sources from Sales Extension", or null when HubSpot gave no Original Source. */
export function originalSourceLabel(source: string | null, detail: string | null): string | null {
  if (!source) return null;
  const main = SOURCE_LABELS[source] ?? titleCase(source);
  if (!detail) return main;
  const sub = source === "OFFLINE" ? (OFFLINE_DETAIL_LABELS[detail] ?? titleCase(detail)) : detail;
  return `${main} from ${sub}`;
}

/** The two Lead columns, from a HubSpot contact's properties. */
export function originalSourceFields(p: Record<string, string | null>) {
  const clean = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    originalSource: clean(p.hs_analytics_source),
    originalSourceDetail: clean(p.hs_analytics_source_data_1),
  };
}
