import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";

// PRD AE03 / 4.10 / 19.5 — strictly private, author-only, same pattern
// as /api/journal. No Manager/Admin override anywhere in this file.

const MOOD_SCORES = new Set([1, 2, 3, 4, 5]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const today = await prisma.mindStateCheckIn.findFirst({
    where: { userId: user.id, createdAt: { gte: todayStart } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ today });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const body = await request.json();

  if (!MOOD_SCORES.has(body.moodScore) || typeof body.mood !== "string") {
    return NextResponse.json(
      { error: "moodScore (1-5) and mood are required" },
      { status: 400 }
    );
  }

  const checkIn = await prisma.mindStateCheckIn.create({
    data: {
      userId: user.id,
      moodScore: body.moodScore,
      mood: body.mood,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    },
  });

  return NextResponse.json(checkIn, { status: 201 });
}
