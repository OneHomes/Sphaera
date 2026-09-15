import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { recordJanusAction } from "@/lib/janusPolicy";

const VALID_DIMENSIONS = new Set(["market", "projectInterest", "source"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  const focuses = await prisma.teamFocus.findMany({
    where: {
      endsAt: { gte: new Date() },
      ...(authUser.role === "ADMIN"
        ? {}
        : authUser.teamId
          ? { OR: [{ teamId: authUser.teamId }, { teamId: null }] }
          : { teamId: null }),
    },
    include: { setBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    focuses.map((f) => ({
      id: f.id,
      dimension: f.dimension,
      value: f.value,
      reason: f.reason,
      setByName: f.setBy.name,
      endsAt: f.endsAt.toISOString(),
      teamId: f.teamId,
    }))
  );
}

// Step 2 of JN12 — the explicit confirm action after a manager has
// reviewed Janus's proposal (POST /api/janus/focus-proposal). This is
// what actually creates the real TeamFocus row; nothing before this
// point has changed anything.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { dimension, value, reason, durationDays, companyWide } = body;

  if (!VALID_DIMENSIONS.has(dimension) || !value || !reason) {
    return NextResponse.json(
      { error: "dimension, value, and reason are required" },
      { status: 400 }
    );
  }
  if (companyWide && authUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only Admins can set a company-wide focus" },
      { status: 403 }
    );
  }

  const days = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 7;
  const focus = await prisma.teamFocus.create({
    data: {
      setById: authUser.id,
      teamId: companyWide ? null : authUser.teamId,
      dimension,
      value,
      reason,
      endsAt: new Date(Date.now() + days * 86_400_000),
    },
  });

  // PRD PF07/JN15 — this went through Janus's proposal step, so it's
  // recorded as an AI-assisted action, distinct from a manager setting
  // this some other way (there is no other way today, but the audit
  // trail should reflect Janus's involvement regardless).
  await recordJanusAction(
    authUser.id,
    session.user?.email ?? "unknown",
    "focus_confirmed",
    focus.id,
    `Team focus set: ${dimension} = "${value}" for ${days} day(s) — ${reason}`
  );

  return NextResponse.json(focus, { status: 201 });
}
