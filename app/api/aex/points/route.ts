import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { checkPointAwardAllowed, logSuspiciousActivity } from "@/lib/aexGovernance";

// Generic point-award endpoint. Other modules (Pipeline stage changes,
// Lead calls logged, meetings conducted) should call this once those
// event triggers are wired up — this is the single place point events
// get created, per PRD Section 14.2 ("Events must originate from trusted
// system activity or require verification"). Right now nothing calls this
// automatically; it's exposed so points can be awarded/tested manually.
//
// Every award passes through checkPointAwardAllowed() first (PRD Section
// 14.12 — Anti Gaming and Governance): duplicate labels within a short
// window and per-label daily caps are rejected and logged, rather than
// silently allowing unlimited repeated point farming.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.label || typeof body.points !== "number") {
    return NextResponse.json(
      { error: "label and points are required" },
      { status: 400 }
    );
  }

  const user = await getOrCreateCurrentUser(session);

  const guard = await checkPointAwardAllowed(user.id, body.label);
  if (!guard.allowed) {
    await logSuspiciousActivity(
      user.id,
      session.user?.email ?? "unknown",
      body.label,
      guard.reason
    );
    return NextResponse.json({ error: guard.reason }, { status: 429 });
  }

  const event = await prisma.aexPointEvent.create({
    data: {
      userId: user.id,
      label: body.label,
      points: body.points,
    },
  });

  return NextResponse.json(event, { status: 201 });
}