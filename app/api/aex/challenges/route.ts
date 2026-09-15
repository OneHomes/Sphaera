import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { resolveExpiredChallenges, CHALLENGE_DURATION_MS } from "@/lib/challenges";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getOrCreateCurrentUser(session);

  await resolveExpiredChallenges();

  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ challengerId: user.id }, { opponentId: user.id }] },
    include: { challenger: true, opponent: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    challenges.map((c) => ({
      id: c.id,
      challengerId: c.challengerId,
      challengerName: c.challenger.name,
      opponentId: c.opponentId,
      opponentName: c.opponent.name,
      status: c.status,
      periodStart: c.periodStart.toISOString(),
      periodEnd: c.periodEnd.toISOString(),
      isMine: c.challengerId === user.id,
    }))
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getOrCreateCurrentUser(session);
  const body = await request.json();
  const { opponentId } = body;

  if (!opponentId || opponentId === user.id) {
    return NextResponse.json({ error: "A valid opponentId is required" }, { status: 400 });
  }

  const opponent = await prisma.user.findUnique({ where: { id: opponentId } });
  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const now = new Date();
  const challenge = await prisma.challenge.create({
    data: {
      challengerId: user.id,
      opponentId,
      periodStart: now,
      periodEnd: new Date(now.getTime() + CHALLENGE_DURATION_MS),
      status: "Pending",
    },
  });

  return NextResponse.json(challenge, { status: 201 });
}
