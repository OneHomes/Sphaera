import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listMailMessages,
  sendMail,
  MAIL_FOLDERS,
  type MailFolder,
} from "@/lib/graph";

const VALID_FOLDERS = MAIL_FOLDERS.map((f) => f.key);

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      {
        error:
          "No Microsoft Graph access token on this session. Sign in with Microsoft (not the testing login) to use Mail.",
      },
      { status: 400 }
    );
  }

  // ?folder=inbox | drafts | sentitems | deleteditems | junkemail | notes | archive
  const { searchParams } = new URL(request.url);
  const folderParam = searchParams.get("folder") as MailFolder | null;
  const folder: MailFolder =
    folderParam && VALID_FOLDERS.includes(folderParam)
      ? folderParam
      : "inbox";

  try {
    const messages = await listMailMessages(session.accessToken, 25, folder);
    return NextResponse.json(messages);
  } catch (err) {
    console.error(`Failed to fetch mail (folder=${folder}):`, err);
    return NextResponse.json(
      { error: `Failed to fetch "${folder}" from Microsoft Graph` },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
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

  const body = await request.json();
  if (!body.to || !body.subject || !body.body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    await sendMail(session.accessToken, body.to, body.subject, body.body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to send mail:", err);
    return NextResponse.json(
      { error: "Failed to send mail via Microsoft Graph" },
      { status: 502 }
    );
  }
}