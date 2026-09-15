import { prisma } from "./prisma";
import { querySalesforce } from "./salesforce";
import { maybeCreateOpportunityFromLead } from "./leadToOpportunity";

// Real Salesforce -> Sphaera Lead sync.
//
// New Salesforce leads are created in full. Already-synced leads get a
// SAFE PARTIAL refresh only — name, contact info, source, market, and
// project interest, i.e. fields Sphaera has no editing UI for at all.
// Stage, priority, engagement, assignment, and score are never touched
// on an update: those are exactly the fields an agent might already
// have changed inside Sphaera, and Sphaera has no write-back to
// Salesforce yet, so blindly overwriting them would risk silently
// reverting real work the moment Salesforce's own copy still shows the
// old value. This means stage/status CAN still go stale relative to
// Salesforce until a real write-back path (or an explicit business
// conflict policy) exists — a known, deliberate limitation, not an
// oversight.

type SalesforceLeadRecord = {
  Id: string;
  Name: string;
  Phone: string | null;
  MobilePhone: string | null;
  Email: string | null;
  LeadSource: string | null;
  Project__c: string | null;
  Interest_Level__c: string | null;
  Rating: string | null;
  CurrencyIsoCode: string | null;
  LastActivityDate: string | null;
  Status: string | null;
  Lead_Score__c: number | null;
  Estimated_Value__c: number | null;
  Closed_Value_All__c: number | null;
  Closing_Date__c: string | null;
  Closed_Date_Final__c: string | null;
  // Real per-project closed value/date fields — confirmed with the
  // business that each project saves its own closed figures separately
  // rather than always rolling up into Closed_Value_All__c.
  Closed_Value__c: number | null; // OSR
  Closed_Date__c: string | null; // OSR
  Closed_Value_Amaya__c: number | null;
  Closed_Date_Amaya__c: string | null;
  Closed_Value_OCR1__c: number | null;
  Closed_Date_OCR__c: string | null;
  Closed_Value_Gwadar1__c: number | null;
  Closed_Date_Gwadar__c: string | null;
  Closed_Value_AP__c: number | null; // AP / Diyar
  Closed_Date_AP__c: string | null;
  Closed_Value_LUNA__c: number | null; // Luna / One Edition
  Closed_Date_LUNA__c: string | null;
  CreatedDate: string;
  Owner: { Email: string } | null;
};

// Project__c is matched by substring since real values are sometimes
// combined (e.g. "AP & OSR & Amaya") — first matching project's own
// closed value/date fields win. Order matters where a lead could match
// more than one (rare combined-project cases favor the first listed).
const PROJECT_CLOSED_FIELD_MAP: {
  match: string;
  value: keyof SalesforceLeadRecord;
  date: keyof SalesforceLeadRecord;
}[] = [
  { match: "Amaya", value: "Closed_Value_Amaya__c", date: "Closed_Date_Amaya__c" },
  { match: "OCR", value: "Closed_Value_OCR1__c", date: "Closed_Date_OCR__c" },
  { match: "Gwadar", value: "Closed_Value_Gwadar1__c", date: "Closed_Date_Gwadar__c" },
  { match: "AP", value: "Closed_Value_AP__c", date: "Closed_Date_AP__c" },
  { match: "Diyar", value: "Closed_Value_AP__c", date: "Closed_Date_AP__c" },
  { match: "Luna", value: "Closed_Value_LUNA__c", date: "Closed_Date_LUNA__c" },
  { match: "One Edition", value: "Closed_Value_LUNA__c", date: "Closed_Date_LUNA__c" },
  { match: "OSR", value: "Closed_Value__c", date: "Closed_Date__c" },
];

// This org tracks the real deal value/close date directly on the Lead
// (see lib/leadToOpportunity.ts), and — per the business — saves the
// CLOSED figures in a separate field per project rather than always in
// the generic rollup. Preference order: project-specific closed value
// -> generic closed-value rollup -> pre-close estimate.
function realDealValue(sf: SalesforceLeadRecord): number | null {
  const projectField = PROJECT_CLOSED_FIELD_MAP.find((p) =>
    sf.Project__c?.includes(p.match)
  );
  const projectValue = projectField ? (sf[projectField.value] as number | null) : null;
  const value = projectValue ?? sf.Closed_Value_All__c ?? sf.Estimated_Value__c;
  return value !== null && value !== undefined ? Math.round(value) : null;
}
function realDealCloseDate(sf: SalesforceLeadRecord): Date | null {
  const projectField = PROJECT_CLOSED_FIELD_MAP.find((p) =>
    sf.Project__c?.includes(p.match)
  );
  const projectDate = projectField ? (sf[projectField.date] as string | null) : null;
  const date = projectDate ?? sf.Closed_Date_Final__c ?? sf.Closing_Date__c;
  return date ? new Date(date) : null;
}

function mapPriority(rating: string | null): string {
  if (rating === "Hot") return "High";
  if (rating === "Warm") return "Medium";
  if (rating === "Cold (Not Interested)") return "Low";
  return "Medium";
}

export type SalesforceSyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  createdLeadNames: string[];
};

export async function syncSalesforceLeads(
  limit = 200,
  whereClause?: string
): Promise<SalesforceSyncResult> {
  const soql = `
    SELECT Id, Name, Phone, MobilePhone, Email, LeadSource, Project__c,
           Interest_Level__c, Rating, CurrencyIsoCode, LastActivityDate,
           Status, Lead_Score__c, Estimated_Value__c, Closed_Value_All__c,
           Closing_Date__c, Closed_Date_Final__c,
           Closed_Value__c, Closed_Date__c,
           Closed_Value_Amaya__c, Closed_Date_Amaya__c,
           Closed_Value_OCR1__c, Closed_Date_OCR__c,
           Closed_Value_Gwadar1__c, Closed_Date_Gwadar__c,
           Closed_Value_AP__c, Closed_Date_AP__c,
           Closed_Value_LUNA__c, Closed_Date_LUNA__c,
           CreatedDate, Owner.Email
    FROM Lead
    ${whereClause ? `WHERE ${whereClause}` : ""}
    ORDER BY CreatedDate DESC
    LIMIT ${limit}
  `.trim();

  const { records } = await querySalesforce(soql);
  const sfLeads = records as unknown as SalesforceLeadRecord[];

  // Resolve Salesforce owner emails -> real Sphaera Users in one query,
  // rather than one lookup per lead.
  const ownerEmails = Array.from(
    new Set(sfLeads.map((l) => l.Owner?.Email).filter((e): e is string => Boolean(e)))
  );
  const sphaeraUsers = ownerEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: ownerEmails } },
        select: { id: true, email: true },
      })
    : [];
  const userIdByEmail = new Map(sphaeraUsers.map((u) => [u.email.toLowerCase(), u.id]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const createdLeadNames: string[] = [];

  for (const sf of sfLeads) {
    const existing = await prisma.lead.findFirst({
      where: { salesforceId: sf.Id },
      select: {
        id: true, name: true, contact: true, source: true, market: true,
        projectInterest: true, estimatedValue: true, estimatedCloseAt: true,
      },
    });

    if (existing) {
      const freshContact = sf.Phone || sf.MobilePhone || sf.Email || "—";
      const freshSource = sf.LeadSource || "Other";
      const freshMarket = sf.CurrencyIsoCode || "Unknown";
      const freshProject = sf.Project__c || "Unspecified";
      const freshValue = realDealValue(sf);
      const freshCloseAt = realDealCloseDate(sf);

      const hasChanged =
        existing.name !== sf.Name ||
        existing.contact !== freshContact ||
        existing.source !== freshSource ||
        existing.market !== freshMarket ||
        existing.projectInterest !== freshProject ||
        existing.estimatedValue !== freshValue ||
        existing.estimatedCloseAt?.getTime() !== freshCloseAt?.getTime();

      if (hasChanged) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            name: sf.Name,
            contact: freshContact,
            source: freshSource,
            market: freshMarket,
            projectInterest: freshProject,
            estimatedValue: freshValue,
            estimatedCloseAt: freshCloseAt,
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } else {
        unchanged++;
      }
      // Backfill safety net: covers a lead whose stage was already at
      // deal-rank before this sync (e.g. imported earlier, before this
      // Opportunity auto-creation existed) but never got one created.
      // No-op if it already has an Opportunity or isn't deal-rank.
      await maybeCreateOpportunityFromLead(existing.id);
      continue;
    }

    const assignedUserId = sf.Owner?.Email
      ? (userIdByEmail.get(sf.Owner.Email.toLowerCase()) ?? null)
      : null;

    const initialScore = Math.max(0, Math.min(100, Math.round(sf.Lead_Score__c ?? 0)));

    const lead = await prisma.lead.create({
      data: {
        name: sf.Name,
        contact: sf.Phone || sf.MobilePhone || sf.Email || "—",
        source: sf.LeadSource || "Other",
        market: sf.CurrencyIsoCode || "Unknown",
        projectInterest: sf.Project__c || "Unspecified",
        stage: sf.Status || "New Lead / Not Contacted Yet",
        score: initialScore,
        engagement: (sf.Interest_Level__c as "High" | "Medium" | "Low") || "Medium",
        priority: mapPriority(sf.Rating),
        lastInteractionAt: sf.LastActivityDate ? new Date(sf.LastActivityDate) : null,
        assignedUserId,
        assignment: assignedUserId ? "Assigned" : "Unassigned",
        prioritizationReason: `Imported from Salesforce (Lead Score: ${sf.Lead_Score__c ?? "n/a"})`,
        salesforceId: sf.Id,
        lastSyncedAt: new Date(),
        estimatedValue: realDealValue(sf),
        estimatedCloseAt: realDealCloseDate(sf),
        createdAt: new Date(sf.CreatedDate),
      },
    });

    // Real trigger — if this lead is already at deal-rank status the
    // moment it's imported, it gets its Opportunity right away rather
    // than waiting for an agent to touch it inside Sphaera.
    await maybeCreateOpportunityFromLead(lead.id);

    // Deliberately NOT recalculating the score right after import — a
    // freshly-imported lead has no Sphaera-side timeline yet, so
    // recalculateLeadScore would immediately zero out the real
    // Salesforce score we just set. It takes over naturally the moment
    // a real event happens (an interaction gets logged, or the stage
    // changes — see app/api/leads/[id]/interactions/route.ts and
    // app/api/leads/[id]/route.ts, the existing real trigger points).
    created++;
    createdLeadNames.push(sf.Name);
  }

  return { fetched: sfLeads.length, created, updated, unchanged, createdLeadNames };
}
