import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMailFolderCounts } from "@/lib/graph";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
}