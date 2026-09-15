import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUser } from "@/lib/authz";
import { acknowledgeWelcome } from "@/lib/dailyWelcome";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  await acknowledgeWelcome(
    authUser.id,
    (session as { signedInAt?: number }).signedInAt
  );

  return NextResponse.json({ success: true });
}
