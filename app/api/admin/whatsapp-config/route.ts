import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Company-level WhatsApp Business Account setup — done once by an Admin
// (per the setup flow: Meta Business Verification -> WABA -> System
// User permanent token). Agents then connect their own individual phone
// numbers against this config (see /api/whatsapp/connect).

export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // findFirst with no further `where` — the Prisma Client Extension
      // (lib/prisma.ts) injects organizationId automatically here, which
      // is what actually makes this return THIS org's config rather than
      // whichever WhatsAppConfig row happens to exist first.
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

      // One config row per organization — the extension scopes this
      // findFirst() to the caller's org, so "existing" correctly means
      // "this org already has a config", not "any org has one".
      const existing = await prisma.whatsAppConfig.findFirst();

      const config = existing
        ? await prisma.whatsAppConfig.update({
            where: { id: existing.id },
            data: { wabaId, metaAppId, systemUserToken, businessName, isVerified: true },
          })
        : await prisma.whatsAppConfig.create({
            data: { wabaId, metaAppId, systemUserToken, businessName, isVerified: true },
          });

      // Security-sensitive integration credentials — never log the token
      // itself, just that it was set/rotated and by whom.
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: existing ? "whatsapp_config_updated" : "whatsapp_config_created",
        targetId: config.id,
        details: `${existing ? "Updated" : "Created"} WhatsApp Business config for "${businessName}"`,
      });

      return NextResponse.json({ id: config.id, businessName: config.businessName });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
