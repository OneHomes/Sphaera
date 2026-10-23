import { NextResponse } from "next/server";
import { getMailFolderCounts } from "@/lib/graph";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      if (!session.accessToken) {
        return NextResponse.json(
          { error: "No Microsoft Graph access token on this session." },
          { status: 400 }
        );
      }

      try {
        const counts = await getMailFolderCounts(session.accessToken);
        return NextResponse.json(counts);
      } catch (err) {
        console.error("Failed to fetch mail folder counts:", err);
        return NextResponse.json(
          { error: "Failed to fetch folder counts from Microsoft Graph" },
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
