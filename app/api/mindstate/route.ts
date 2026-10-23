import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD AE03 / 4.10 / 19.5 — strictly private, author-only, same pattern
// as /api/journal. No Manager/Admin override anywhere in this file.

const MOOD_SCORES = new Set([1, 2, 3, 4, 5]);

export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const today = await prisma.mindStateCheckIn.findFirst({
        where: { userId: user.id, createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ today });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
