import { prisma } from "./prisma";
import { awardBadgeIfNew } from "./badges";

// PRD AEX 14.9 (Streaks). Previously `UserStreak.currentCount` was only
// ever set once, at signup, and nothing incremented or reset it.
//
// "Daily mission completion" is hard to evaluate literally — Mission
// Centre items are computed dynamically, not a fixed checklist with a
// stored "done" flag — so this build uses a real, honest proxy: logging
// genuine activity (an interaction, or completing a task) on a given
// calendar day counts as that day's mission being worked. This is a
// lazy, on-write check (no cron in this serverless architecture, same
// constraint as lib/leadLocks.ts and lib/notifications.ts) rather than a
// scheduled midnight reset.

const DAILY_STREAK_LABEL = "Daily mission completion";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Call whenever a user does something that counts as "working today's
 * mission" (logging an interaction, completing a task). Idempotent per
 * calendar day — calling it multiple times in the same day is a no-op
 * after the first.
 */
export async function recordDailyActivity(userId: string): Promise<void> {
  const streak = await prisma.userStreak.findFirst({
    where: { userId, label: DAILY_STREAK_LABEL },
  });
  if (!streak) return; // defensive — every user is seeded one at signup

  const today = startOfDay(new Date());
  const lastCountedDay = startOfDay(streak.updatedAt);
  const dayDiff = Math.round((today.getTime() - lastCountedDay.getTime()) / 86_400_000);

  if (dayDiff === 0) return; // already counted today

  const newCount = dayDiff === 1 ? streak.currentCount + 1 : 1; // consecutive day increments; a gap resets to 1 (today counts)

  await prisma.userStreak.update({
    where: { id: streak.id },
    data: { currentCount: newCount },
  });

  // PRD AEX 14.8 — first time this user reaches a 7-day streak.
  if (newCount === 7) {
    await awardBadgeIfNew(
      userId,
      "Consistency Streak",
      "Maintained a 7-day daily activity streak"
    );
  }
}
