import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMailMessages, sendMail } from "@/lib/graph";

export async function GET() {
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

  try {
    const messages = await listMailMessages(session.accessToken, 25);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("Failed to fetch mail:", err);
    return NextResponse.json(
      { error: "Failed to fetch mail from Microsoft Graph" },
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