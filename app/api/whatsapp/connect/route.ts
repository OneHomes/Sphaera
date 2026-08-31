import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { addPhoneNumber, requestVerificationCode } from "@/lib/whatsapp";

// Step 1 of the self-service "Connect WhatsApp" flow (Settings/Profile
// page): agent submits their phone number, we register it against the
// company's WABA and trigger an OTP. Step 2 is /api/whatsapp/verify.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.whatsAppConfig.findFirst();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "WhatsApp Business isn't set up for this organization yet. Ask an Admin to complete setup first.",
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { countryCode, phoneNumber } = body;
  if (!countryCode || !phoneNumber) {
    return NextResponse.json(
      { error: "countryCode and phoneNumber are required" },
      { status: 400 }
    );
  }

  const user = await getOrCreateCurrentUser(session);

  const existing = await prisma.whatsAppNumber.findUnique({
    where: { userId: user.id },
  });
  if (existing?.verifiedAt) {
    return NextResponse.json(
      { error: "You already have a verified WhatsApp number connected." },
      { status: 409 }
    );
  }

  try {
    const { phoneNumberId } = await addPhoneNumber(
      config.wabaId,
      config.systemUserToken,
      countryCode,
      phoneNumber,
      user.name
    );

    await requestVerificationCode(phoneNumberId, config.systemUserToken, "SMS");

    // Store as unverified until the OTP is confirmed
    await prisma.whatsAppNumber.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        configId: config.id,
        phoneNumber: `${countryCode}${phoneNumber}`,
        phoneNumberId,
      },
      update: {
        phoneNumber: `${countryCode}${phoneNumber}`,
        phoneNumberId,
        verifiedAt: null,
      },
    });

    return NextResponse.json({ success: true, phoneNumberId });
  } catch (err) {
    console.error("Failed to add/verify WhatsApp number:", err);
    return NextResponse.json(
      {
        error:
          "Failed to register this number with WhatsApp. Check the number and try again.",
      },
      { status: 502 }
    );
  }
}