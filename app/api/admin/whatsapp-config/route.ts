import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";

// Company-level WhatsApp Business Account setup — done once by an Admin
// (per the setup flow: Meta Business Verification -> WABA -> System
// User permanent token). Agents then connect their own individual phone
// numbers against this config (see /api/whatsapp/connect).

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.whatsAppConfig.findFirst({
    include: { numbers: { include: { user: true } } },
  });

  if (!config) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    id: config.id,
    businessName: config.businessName,
    isVerified: config.isVerified,
    connectedNumbers: config.numbers.map((n) => ({
      id: n.id,
      userName: n.user.name,
      phoneNumber: n.phoneNumber,
      verifiedAt: n.verifiedAt,
    })),
    // Never return the raw token to the client — its presence is enough
    // for the UI to show "configured" without exposing the secret.
    hasToken: Boolean(config.systemUserToken),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { wabaId, metaAppId, systemUserToken, businessName } = body;

  if (!wabaId || !metaAppId || !systemUserToken || !businessName) {
    return NextResponse.json(
      {
        error:
          "wabaId, metaAppId, systemUserToken, and businessName are all required",
      },
      { status: 400 }
    );
  }

  // Single-tenant for now: at most one config row exists. A future
  // multi-tenant version would key this by organizationId instead.
  const existing = await prisma.whatsAppConfig.findFirst();

  const config = existing
    ? await prisma.whatsAppConfig.update({
        where: { id: existing.id },
        data: { wabaId, metaAppId, systemUserToken, businessName, isVerified: true },
      })
    : await prisma.whatsAppConfig.create({
        data: { wabaId, metaAppId, systemUserToken, businessName, isVerified: true },
      });

  return NextResponse.json({ id: config.id, businessName: config.businessName });
}