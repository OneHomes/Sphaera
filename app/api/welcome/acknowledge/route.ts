import { NextResponse } from "next/server";
import { acknowledgeWelcome } from "@/lib/dailyWelcome";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST() {
  try {
    return await withTenant(async (authUser, session) => {
      await acknowledgeWelcome(
        authUser.id,
        (session as { signedInAt?: number }).signedInAt
      );

      return NextResponse.json({ success: true });
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
