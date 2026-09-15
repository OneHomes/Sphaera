import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { createNotification } from "@/lib/notifications";
import { CHALLENGE_DURATION_MS } from "@/lib/challenges";

// PRD 14.9/14.10 — accept/decline a pending peer challenge. This is the
// endpoint MyChallenges.tsx has always called; it just didn't exist yet.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getOrCreateCurrentUser(session);

  const body = await request.json();
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'decline'" },
      { status: 400 }
    );
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    include: { challenger: true },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challenge.opponentId !== user.id) {
    return NextResponse.json(
      { error: "Only the challenged user can respond to this challenge" },
      { status: 403 }
    );
  }
  if (challenge.status !== "Pending") {
    return NextResponse.json(
      { error: `This challenge is already ${challenge.status}` },
      { status: 409 }
    );
  }

  const now = new Date();
  const updated = await prisma.challenge.update({
    where: { id: params.id },
    data:
      body.action === "accept"
        ? {
            status: "Active",
            // The 7-day scoring window starts now, from acceptance — not
            // from whenever the challenger originally proposed it.
            periodStart: now,
            periodEnd: new Date(now.getTime() + CHALLENGE_DURATION_MS),
          }
        : { status: "Declined", resolvedAt: now },
  });

  await createNotification(
    challenge.challengerId,
    "challenge_update",
    body.action === "accept" ? "Challenge accepted" : "Challenge declined",
    `${user.name} ${body.action === "accept" ? "accepted" : "declined"} your challenge`,
    "/aex"
  );

  return NextResponse.json(updated);
}
