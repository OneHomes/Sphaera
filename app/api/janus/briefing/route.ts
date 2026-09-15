import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getDailyBriefingData, type BriefingPeriod } from "@/lib/dailyBriefing";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const { searchParams } = new URL(request.url);
  const period: BriefingPeriod = searchParams.get("period") === "week" ? "week" : "day";

  try {
    const data = await getDailyBriefingData(user.id, period);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Briefing failed:", err);
    return NextResponse.json(
      {
        error: "Janus couldn't put together your briefing. Try again in a moment.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
