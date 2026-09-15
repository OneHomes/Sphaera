import type { Session } from "next-auth";
import type { Role } from "./roles";
import { getOrCreateCurrentUser } from "./currentUser";
// Central policy layer. Every API route that returns or mutates
// Lead/Opportunity data should go through these functions rather than
// writing its own ad-hoc permission check — this is the single place
// scoping rules live, per PRD PF02 ("Access is evaluated at page,
// feature, record, and action level").

export type AuthUser = {
  id: string;
  role: Role;
  teamId: string | null;
};

/** Extracts the scoping-relevant fields from a NextAuth session. */
export function getAuthUser(session: Session): AuthUser {
  const user = session.user as
    | { id?: string; role?: string; teamId?: string | null }
    | undefined;

  if (!user?.id) {
    throw new Error("Session is missing a resolved user id");
  }

  return {
    id: user.id,
    role: (user.role as Role) ?? "AGENT",
    teamId: user.teamId ?? null,
  };
}

/**
 * Same shape as getAuthUser, but reads role/teamId from the database
 * instead of the JWT session. The session's role/teamId are only
 * refreshed on a fresh sign-in (see lib/auth.ts's jwt callback), so any
 * role- or team-gated page/route that must reflect a change immediately
 * (rather than after the user's next login) should use this instead of
 * getAuthUser.
 */
export async function getFreshAuthUser(session: Session): Promise<AuthUser> {
  const user = await getOrCreateCurrentUser(session);
  return {
    id: user.id,
    role: user.role as Role,
    teamId: user.teamId,
  };
}

/**
 * Builds a Prisma `where` clause scoping which Leads a user is allowed to
 * query/list.
 *  - ADMIN: no restriction (sees everything)
 *  - MANAGER: sees leads assigned to their team, plus the unassigned pool
 *  - AGENT: sees their own assigned leads, plus the unassigned pool
 *    (agents need visibility into the pool to be able to self-assign)
 */
export function getLeadScopeWhere(user: AuthUser) {
  if (user.role === "ADMIN") return {};

  if (user.role === "MANAGER" && user.teamId) {
    return {
      OR: [
        { assignedUser: { teamId: user.teamId } },
        { assignedUserId: null },
      ],
    };
  }

  return {
    OR: [{ assignedUserId: user.id }, { assignedUserId: null }],
  };
}

/** Same scoping logic, for Opportunity. */
export function getOpportunityScopeWhere(user: AuthUser) {
  if (user.role === "ADMIN") return {};

  if (user.role === "MANAGER" && user.teamId) {
    return {
      OR: [
        { assignedUser: { teamId: user.teamId } },
        { assignedUserId: null },
      ],
    };
  }

  return {
    OR: [{ assignedUserId: user.id }, { assignedUserId: null }],
  };
}

/**
 * Checks whether a user may access/modify a single record given its
 * owner's id and team. Used for GET/PATCH on a specific record, where a
 * list-level `where` filter isn't in play.
 */
export function canAccessRecord(
  user: AuthUser,
  ownerId: string | null,
  ownerTeamId: string | null
): boolean {
  if (user.role === "ADMIN") return true;
  if (ownerId === null) return true; // unassigned pool — visible to all
  if (ownerId === user.id) return true;
  if (user.role === "MANAGER" && user.teamId && ownerTeamId === user.teamId) {
    return true;
  }
  return false;
}

/** Throws-free role gate — returns true/false, caller decides the response. */
export function hasRole(user: AuthUser, allowed: Role[]): boolean {
  return allowed.includes(user.role);
}