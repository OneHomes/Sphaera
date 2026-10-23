import { NextResponse } from "next/server";
import { replyToMessage, forwardMessage, deleteMessage } from "@/lib/graph";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!session.accessToken) {
        return NextResponse.json(
          { error: "No Microsoft Graph access token on this session." },
          { status: 400 }
        );
      }

      const body = await request.json();
      const action: string | undefined = body.action; // "reply" | "replyAll" | "forward"
      const comment: string = body.comment ?? "";

      try {
        if (action === "reply") {
          await replyToMessage(session.accessToken, params.id, comment, false);
        } else if (action === "replyAll") {
          await replyToMessage(session.accessToken, params.id, comment, true);
        } else if (action === "forward") {
          if (!body.to) {
            return NextResponse.json(
              { error: "to is required for forward" },
              { status: 400 }
            );
          }
          await forwardMessage(session.accessToken, params.id, body.to, comment);
        } else {
          return NextResponse.json(
            { error: "action must be reply, replyAll, or forward" },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (err) {
        console.error(`Failed to ${action} message:`, err);
        return NextResponse.json(
          { error: `Failed to ${action} message via Microsoft Graph` },
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!session.accessToken) {
        return NextResponse.json(
          { error: "No Microsoft Graph access token on this session." },
          { status: 400 }
        );
      }

      try {
        await deleteMessage(session.accessToken, params.id);
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error("Failed to delete message:", err);
        return NextResponse.json(
          { error: "Failed to delete message via Microsoft Graph" },
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
