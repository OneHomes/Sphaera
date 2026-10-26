import { prisma, tenantContext } from "@/lib/prisma";

// Machine-to-machine auth for the ERP inbound-staging routes
// (app/api/finance/erp/stage*/route.ts). No real ERP system is wired up
// to call these yet (see lib/finance/erpRegistryData.ts's module
// comment) — these exist as the receiving end for whenever that
// happens, authenticated by a shared bearer token (FINANCE_ERP_SYNC_TOKEN)
// instead of a user session, since there is no signed-in user making the
// call. Mirrors the source Python app's separate ERP_SYNC_TOKEN-gated
// webhook auth, kept distinct from normal user-facing Finance routes'
// withTenant()/canAccessFinance checks.

export function hasValidErpSyncToken(request: Request): boolean {
  const expected = process.env.FINANCE_ERP_SYNC_TOKEN;
  if (!expected) return false; // never authenticate against an unset/empty token
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return match[1] === expected;
}

// Every ERP source registered in this app today belongs to One Homes
// (the only tenant with Finance enabled) — same single-tenant resolution
// as lib/currentUser.ts's getOneHomesOrganizationId(), duplicated here
// rather than imported since that one is private to the Entra
// sign-in path.
const ONE_HOMES_SLUG = "one-homes";
let cachedOneHomesOrgId: string | undefined;

async function getOneHomesOrganizationId(): Promise<string> {
  if (cachedOneHomesOrgId) return cachedOneHomesOrgId;
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: ONE_HOMES_SLUG } });
  cachedOneHomesOrgId = org.id;
  return org.id;
}

/**
 * Runs `fn` inside the One Homes tenant context. The three bearer-token
 * ERP staging routes call this in place of withTenant() (which requires
 * a user Session they don't have) so that FinanceErpSource/
 * FinanceErpSyncStaging/FinanceErpBankBalance writes still get an
 * explicit organizationId rather than relying on lib/prisma.ts's
 * no-context fallback.
 */
export async function runAsOneHomesTenant<T>(fn: () => Promise<T>): Promise<T> {
  const organizationId = await getOneHomesOrganizationId();
  return tenantContext.run({ organizationId }, fn);
}
