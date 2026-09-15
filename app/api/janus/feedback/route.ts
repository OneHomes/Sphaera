import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";

// PRD JN14 (Explainability and Feedback) — "was this useful?" capture
// for Janus outputs that don't already have their own richer
// accept/edit/reject flow (Next Best Action, Compose already do).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
