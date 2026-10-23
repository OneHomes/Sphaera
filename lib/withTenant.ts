import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./auth";
import { getAuthUser, getFreshAuthUser, type AuthUser } from "./authz";
import { tenantContext } from "./prisma";

// The one thing every route/page needs to add to become properly
// tenant-aware (see lib/prisma.ts's Client Extension for the enforcement
// side). Resolves the authenticated user, then runs the rest of the
// handler inside an AsyncLocalStorage context carrying their
// organizationId — every tenant-scoped Prisma query made anywhere
// during that callback automatically gets scoped to it.
//
// A route that does NOT use this wrapper keeps working exactly as
// before (the extension falls back to the One Homes organization) — this
// is what makes rolling it out across the remaining ~110 files
// afterward purely additive, never a breaking change.

export class UnauthenticatedError extends Error {
  constructor() {
    super("No authenticated session");
    this.name = "UnauthenticatedError";
  }
}

/**
 * For API routes (app/api/**\/route.ts). Throws UnauthenticatedError if
 * there's no session — callers should catch it and return 401.
 *
 * `fresh` (default true) picks which of lib/authz.ts's two resolvers
 * runs: fresh re-reads role/teamId/canExportData from the DB (needed
 * wherever a permission change must apply before the user's next
 * sign-in); `fresh: false` uses the cheaper JWT-cached getAuthUser for
 * routes that were already using that — same freshness trade-off
 * authz.ts has always documented, just threaded through here too.
 */
export async function withTenant<T>(
  handler: (authUser: AuthUser, session: Session) => Promise<T>,
  options?: { fresh?: boolean }
): Promise<T> {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new UnauthenticatedError();
  }
  const authUser =
    options?.fresh === false ? getAuthUser(session) : await getFreshAuthUser(session);
  return tenantContext.run({ organizationId: authUser.organizationId }, () => handler(authUser, session));
}

/** For server components/pages — caller has already redirected on no-session, so this assumes one exists. */
export async function withTenantPage<T>(session: Session, handler: (authUser: AuthUser) => Promise<T>): Promise<T> {
  const authUser = await getFreshAuthUser(session);
  return tenantContext.run({ organizationId: authUser.organizationId }, () => handler(authUser));
}
