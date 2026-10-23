import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD 4.10 / 19.5 — Journal entries are strictly private to their
// author. Unlike Lead/Opportunity, there is deliberately NO
// Manager/Admin override anywhere in this file — every query is always
// scoped to the signed-in user's own authorId, full stop.

export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);

      const entries = await prisma.journalEntry.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(entries);
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

      if (!body.title || !body.title.trim() || !body.body) {
        return NextResponse.json(
          { error: "title and body are required" },
          { status: 400 }
        );
      }

      const entry = await prisma.journalEntry.create({
        data: {
          authorId: user.id,
          folder: body.folder || "Work",
          title: body.title.trim(),
          body: body.body,
        },
      });

      return NextResponse.json(entry, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
