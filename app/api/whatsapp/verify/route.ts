import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { verifyPhoneNumberCode } from "@/lib/whatsapp";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Step 2 of the self-service "Connect WhatsApp" flow: agent submits the
// OTP code they received via SMS/call, we confirm it with Meta, and mark
// their number as verified/active.
export async function POST(request: Request) {
  try {
    return await withTenant(async (_authUser, session) => {
      const body = await request.json();
      const { code } = body;
      if (!code) {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
      }

      const user = await getOrCreateCurrentUser(session);
      const config = await prisma.whatsAppConfig.findFirst();
      const whatsappNumber = await prisma.whatsAppNumber.findUnique({
        where: { userId: user.id },
      });

      if (!config || !whatsappNumber) {
        return NextResponse.json(
          { error: "No pending WhatsApp connection found. Start over." },
          { status: 400 }
        );
      }

      try {
        await verifyPhoneNumberCode(
          whatsappNumber.phoneNumberId,
          config.systemUserToken,
          code
        );

        const updated = await prisma.whatsAppNumber.update({
          where: { userId: user.id },
          data: { verifiedAt: new Date() },
        });

        // This is the moment the number becomes a live, usable channel on
        // behalf of the org — the security-relevant event, not step 1.
        await logAudit({
          actorId: user.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "whatsapp_number_verified",
          targetId: updated.id,
          details: `Verified and connected WhatsApp number ${updated.phoneNumber}`,
        });

        return NextResponse.json({
          success: true,
          phoneNumber: updated.phoneNumber,
        });
      } catch (err) {
        console.error("Failed to verify WhatsApp OTP:", err);
        return NextResponse.json(
          { error: "Incorrect or expired code. Try again." },
          { status: 400 }
        );
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
