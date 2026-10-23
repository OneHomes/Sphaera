import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD JN14 (Explainability and Feedback) — "was this useful?" capture
// for Janus outputs that don't already have their own richer
// accept/edit/reject flow (Next Best Action, Compose already do).
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const body = await request.json();
      const { context, useful, note } = body;

      if (!context || typeof useful !== "boolean") {
        return NextResponse.json(
          { error: "context and useful (boolean) are required" },
          { status: 400 }
        );
      }

      const feedback = await prisma.janusFeedback.create({
        data: { userId: user.id, context, useful, note: note || undefined },
      });

      return NextResponse.json(feedback, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
