import type { Session } from "next-auth";
import { prisma } from "./prisma";

// One Homes is the only Entra ID (Microsoft 365) tenant Sphaera signs in
// today — new multi-tenant orgs use email+password instead (see
// lib/auth.ts's Credentials provider), so every Entra sign-in resolves
// to this one Organization specifically, rather than needing real
// per-request tenant resolution (subdomain, invite binding, etc.) for
// this sign-in path. Cached after the first lookup per process.
const ONE_HOMES_SLUG = "one-homes";
let cachedOneHomesOrgId: string | undefined;
async function getOneHomesOrganizationId(): Promise<string> {
  if (cachedOneHomesOrgId) return cachedOneHomesOrgId;
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: ONE_HOMES_SLUG } });
  cachedOneHomesOrgId = org.id;
  return org.id;
}

// Core lookup/creation logic, usable both from server components (which
// have a full Session) and from the NextAuth jwt callback (which only has
// email/name/oid, not a full Session object) — see lib/auth.ts.
export async function getOrCreateUserByEmail(
  email: string,
  name?: string | null,
  entraId?: string | null
) {
  // email alone is no longer a unique selector (User.email's uniqueness
  // is now composite on [organizationId, email]) — findFirst instead of
  // findUnique. This path is Entra-only/One Homes-only (see comment
  // above), so there's only ever one real match in practice.
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return existing;

  const organizationId = await getOneHomesOrganizationId();
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      name: name ?? email.split("@")[0],
      entraId: entraId ?? undefined,
      pointEvents: {
        create: [{ label: "Welcome bonus — account created", points: 25 }],
      },
      badges: {
        create: [
          {
            name: "Getting Started",
            description: "Signed in to Sphaera for the first time",
          },
        ],
      },
      streaks: {
        create: [
          {
            label: "Daily mission completion",
            currentCount: 0,
            resetRule:
              "Resets at midnight if the day's mission isn't completed",
          },
        ],
      },
    },
  });

  return user;
}

export async function getOrCreateCurrentUser(session: Session) {
  const email = session.user?.email;
  if (!email) {
    throw new Error("Session has no email — cannot resolve a User row");
  }
  const entraId = (session.user as { oid?: string } | undefined)?.oid;
  return getOrCreateUserByEmail(email, session.user?.name, entraId);
}