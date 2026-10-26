import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";

// Public endpoint by necessity (no session exists yet — this IS how a
// new organization's first/next user gets one) — see
// prisma/schema.prisma's OrganizationInvite model. Accepts a token
// generated when the invite was created, creates the User row scoped to
// that invite's organization, and marks the invite used.
export async function POST(request: Request) {
  const body = await request.json();
  const { token, name, password } = body as { token?: string; name?: string; password?: string };

  if (!token || !name || !password) {
    return NextResponse.json({ error: "token, name, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const invite = await prisma.organizationInvite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
  }

  // An invite locked to one address (invite.email set) can only be
  // accepted by that exact email — an open/shareable invite (email
  // null) is accepted with whatever email the new user provides.
  const email = invite.email ?? (body.email as string | undefined);
  if (!email) {
    return NextResponse.json({ error: "email is required for this invite" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { organizationId: invite.organizationId, email },
  });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists in this organization" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        organizationId: invite.organizationId,
        email,
        name,
        passwordHash,
        role: invite.role,
      },
    }),
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  // Identity-relevant: a new account was just created via invite — logged
  // against the new user's own id since they're the one who took the action.
  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "user_invite_accepted",
    targetId: user.id,
    details: `Account created via invite (role: ${user.role})`,
  });

  return NextResponse.json({ userId: user.id, email: user.email }, { status: 201 });
}
