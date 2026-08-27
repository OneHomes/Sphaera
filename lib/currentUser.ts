import type { Session } from "next-auth";
import { prisma } from "./prisma";

// Core lookup/creation logic, usable both from server components (which
// have a full Session) and from the NextAuth jwt callback (which only has
// email/name/oid, not a full Session object) — see lib/auth.ts.
export async function getOrCreateUserByEmail(
  email: string,
  name?: string | null,
  entraId?: string | null
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const user = await prisma.user.create({
    data: {
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