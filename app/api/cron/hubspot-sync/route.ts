import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runScheduledActivitySync, runScheduledBehavioralSync } from "@/lib/scheduledHubSpotSync";

// Called every 15 minutes by .github/workflows/scheduled-sync.yml (Azure
// Static Web Apps has no built-in scheduler). Protected by a shared secret:
// CRON_SECRET must be set to the same value in the app's Azure environment
// settings and in the GitHub repo's Actions secrets.
//
// One request per step, each well under Azure's ~45s request limit:
//   POST ?step=activity
//   POST ?step=behavioral&offset=0, then &offset=<nextOffset> until it's null

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice("Bearer ".length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Confirms the endpoint is deployed and its secret is set (never reveals it). */
export async function GET() {
  return NextResponse.json({ ok: true, secretConfigured: Boolean(process.env.CRON_SECRET) });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    console.warn(`Scheduled sync rejected: ${process.env.CRON_SECRET ? "wrong or missing secret" : "CRON_SECRET not set"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const step = params.get("step");
  try {
    let result;
    if (step === "activity") {
      result = await runScheduledActivitySync();
    } else if (step === "behavioral") {
      const offset = Number(params.get("offset") ?? "0");
      if (!Number.isInteger(offset) || offset < 0) return NextResponse.json({ error: "Bad offset" }, { status: 400 });
      result = await runScheduledBehavioralSync(offset);
    } else {
      return NextResponse.json({ error: "step must be activity or behavioral" }, { status: 400 });
    }
    console.log(`Scheduled HubSpot sync (${step}):`, JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    console.error(`Scheduled HubSpot sync (${step}) failed:`, err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
