import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLastAuthError } from "@/lib/debugAuthState";

// TEMPORARY — delete this whole route (and lib/debugAuthState.ts, and
// the one call site in lib/auth.ts) once the real cause of the
// production sign-in failure is found. Gated by NEXTAUTH_SECRET via
// ?key= so this isn't a public endpoint even temporarily, but this is
// still a bare secret-in-URL check — remove promptly regardless of the
// outcome, not just once it's "fixed."
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inMemory = getLastAuthError();

  let fromAuditLog = null;
  try {
    fromAuditLog = await prisma.auditLog.findFirst({
      where: { action: "auth_callback_error" },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    // If even this fails, that itself is the answer: the database is
    // genuinely unreachable from this deployment.
    return NextResponse.json({
      inMemory,
      auditLogReadFailed: true,
      auditLogReadError: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ inMemory, fromAuditLog });
}
