import { NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getDailyBriefingData, type BriefingPeriod } from "@/lib/dailyBriefing";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
