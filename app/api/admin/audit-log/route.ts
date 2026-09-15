import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { toCsv, csvResponse } from "@/lib/csv";

// PF07 (Audit Trail) + PRD Section 14.12 ("the governance report must
// show suspicious patterns, rule versions, and manual adjustments") —
// this is the read surface for the AuditLog table, showing both RBAC
// role/team changes and AEX anti-gaming rejections.
//
// PF07 acceptance criterion: "Authorised administrators can search and
// export audit events" — ?search= filters action/actorEmail/details,
// ?format=csv exports the full matching set (uncapped) instead of the
// normal 50-row JSON page.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const isExport = searchParams.get("format") === "csv";

  const where = search
    ? {
        OR: [
          { action: { contains: search } },
          { actorEmail: { contains: search } },
          { details: { contains: search } },
        ],
      }
    : {};

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(isExport ? {} : { take: 50 }),
  });

  if (isExport) {
    const csv = toCsv(
      entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      [
        { key: "createdAt", label: "Timestamp" },
        { key: "actorEmail", label: "Actor" },
        { key: "action", label: "Action" },
        { key: "targetId", label: "Target ID" },
        { key: "details", label: "Details" },
      ]
    );
    return csvResponse(csv, `sphaera-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      actorEmail: e.actorEmail,
      action: e.action,
      details: e.details,
      createdAt: e.createdAt.toISOString(),
    }))
  );
}