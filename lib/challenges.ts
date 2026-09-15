import { prisma } from "./prisma";
import { createNotification } from "./notifications";

// PRD 14.9/14.10 — a challenge runs for a fixed 7-day window from the
// moment it's accepted, judged on AEX points earned during that window
// (the only metric AEX can currently compare head-to-head).
export const CHALLENGE_DURATION_MS = 7 * 24 * 3_600_000;

async function sumPointsInWindow(userId: string, from: Date, to: Date): Promise<number> {
  const agg = await prisma.aexPointEvent.aggregate({
    where: { userId, createdAt: { gte: from, lte: to } },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

/**
 * Lazy resolution, same pattern as lib/leadLocks.ts's expired-lock
 * release — checked on read rather than via a scheduled job, since this
 * serverless architecture has no background cron.
 */
export async function resolveExpiredChallenges(): Promise<void> {
  const now = new Date();
  const expired = await prisma.challenge.findMany({
    where: { status: "Active", periodEnd: { lt: now } },
  });

  for (const challenge of expired) {
    const [challengerPoints, opponentPoints] = await Promise.all([
      sumPointsInWindow(challenge.challengerId, challenge.periodStart, challenge.periodEnd),
      sumPointsInWindow(challenge.opponentId, challenge.periodStart, challenge.periodEnd),
    ]);

    const status =
      challengerPoints > opponentPoints
        ? "ChallengerWon"
        : challengerPoints < opponentPoints
          ? "OpponentWon"
          : "Draw";

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status, resolvedAt: now },
    });

    if (status !== "Draw") {
      const winnerId = status === "ChallengerWon" ? challenge.challengerId : challenge.opponentId;
      const loserId = status === "ChallengerWon" ? challenge.opponentId : challenge.challengerId;
      await Promise.all([
        createNotification(winnerId, "challenge_update", "Challenge won!", "You won your peer challenge.", "/aex"),
        createNotification(loserId, "challenge_update", "Challenge ended", "Your peer challenge has ended — better luck next time.", "/aex"),
      ]);
    } else {
      await Promise.all([
        createNotification(challenge.challengerId, "challenge_update", "Challenge ended in a draw", "Your peer challenge ended in a draw.", "/aex"),
        createNotification(challenge.opponentId, "challenge_update", "Challenge ended in a draw", "Your peer challenge ended in a draw.", "/aex"),
      ]);
    }
  }
}
