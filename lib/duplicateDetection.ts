import { prisma } from "./prisma";

// Phase 1 Sales Scope — "Detect likely duplicates." Contact info (phone
// or email) is the reliable signal — normalize it so formatting
// differences ("+44 7441 913824" vs "07441913824") don't hide a real
// match. Name is a weaker secondary signal, used only as an exact
// case-insensitive match (no fuzzy-matching library in this build).
function normalizeContact(contact: string): string {
  const trimmed = contact.trim().toLowerCase();
  // Email-like: compare as-is (lowercased). Otherwise treat as a phone
  // number and strip everything but digits, then drop a leading
  // country/trunk "0"/"00" variance by comparing the last 9 digits —
  // enough to catch "+44 7441 913824" vs "07441 913824" vs "7441913824".
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/[^0-9]/g, "");
  return digits.slice(-9);
}

export type DuplicateCandidate = {
  leadId: string;
  name: string;
  matchReason: string;
};

export async function findLikelyDuplicates(
  contact: string,
  name: string,
  excludeLeadId: string
): Promise<DuplicateCandidate[]> {
  const normalizedContact = normalizeContact(contact);
  if (!normalizedContact) return [];

  const candidates = await prisma.lead.findMany({
    where: { id: { not: excludeLeadId } },
    select: { id: true, name: true, contact: true },
  });

  const matches: DuplicateCandidate[] = [];
  for (const candidate of candidates) {
    const candidateNormalized = normalizeContact(candidate.contact);
    if (normalizedContact.length >= 7 && candidateNormalized === normalizedContact) {
      matches.push({ leadId: candidate.id, name: candidate.name, matchReason: "Same contact info" });
    } else if (candidate.name.trim().toLowerCase() === name.trim().toLowerCase()) {
      matches.push({ leadId: candidate.id, name: candidate.name, matchReason: "Same name" });
    }
  }
  return matches;
}

/**
 * Called right after a new lead is created (manual entry or sync) — logs
 * a flag per likely duplicate found, never blocks creation. Safe to call
 * even if duplicateDetection somehow runs twice for the same lead: it
 * only creates a flag for a (leadId, duplicateOfId) pair that doesn't
 * already have a pending one.
 */
export async function flagDuplicatesForLead(leadId: string, contact: string, name: string): Promise<void> {
  try {
    const matches = await findLikelyDuplicates(contact, name, leadId);
    for (const match of matches) {
      const existingFlag = await prisma.duplicateLeadFlag.findFirst({
        where: {
          status: "pending",
          OR: [
            { leadId, duplicateOfId: match.leadId },
            { leadId: match.leadId, duplicateOfId: leadId },
          ],
        },
      });
      if (existingFlag) continue;

      await prisma.duplicateLeadFlag.create({
        data: { leadId, duplicateOfId: match.leadId, matchReason: match.matchReason },
      });
    }
  } catch (err) {
    // Best-effort — a detection failure should never break real lead
    // creation/sync.
    console.error("Duplicate detection failed:", err);
  }
}
