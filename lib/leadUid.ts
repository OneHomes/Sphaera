import { prisma } from "./prisma";

// Phase 1 Sales Scope — "Unique client ID (UID)": generated once when a
// lead is created, used as the reference across payments and outbound
// Onyx records, and must never change thereafter.
//
// Format: SPH-XXXXXXXX, 8 characters from an unambiguous alphabet (no
// 0/O or 1/I) — readable aloud over a phone call for a payment reference,
// with ~32^8 (~1 trillion) combinations so a collision is practically
// impossible; the check-and-retry loop below exists only as a safety net,
// not because collisions are expected.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const UID_LENGTH = 8;

function randomUid(): string {
  let suffix = "";
  for (let i = 0; i < UID_LENGTH; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `SPH-${suffix}`;
}

export async function generateUniqueLeadUid(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomUid();
    const existing = await prisma.lead.findFirst({
      where: { uid: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique lead UID after 5 attempts");
}
