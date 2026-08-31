import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { verifyPhoneNumberCode } from "@/lib/whatsapp";

// Step 2 of the self-service "Connect WhatsApp" flow: agent submits the
// OTP code they received via SMS/call, we confirm it with Meta, and mark
// their number as verified/active.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}