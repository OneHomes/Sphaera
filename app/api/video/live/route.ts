import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { liveKitConfig, roomService } from "@/lib/video/livekit";

// Admin: calls that are open right now, with who is actually in each room
// (from LiveKit). Hidden monitors are not counted.
export async function GET() {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!liveKitConfig()) return NextResponse.json({ error: "Video calls aren't set up yet" }, { status: 503 });

      const calls = await prisma.videoCall.findMany({
        where: { status: { not: "ended" }, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const [agents, leads] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: calls.map((c) => c.agentUserId) } }, select: { id: true, name: true } }),
        prisma.lead.findMany({
          where: { id: { in: calls.map((c) => c.leadId).filter((x): x is string => !!x) } },
          select: { id: true, name: true },
        }),
      ]);
      const agentName = new Map(agents.map((a) => [a.id, a.name]));
      const leadName = new Map(leads.map((l) => [l.id, l.name]));

      const rooms = roomService();
      const rows = await Promise.all(
        calls.map(async (c) => {
          // A room only exists in LiveKit once someone has joined it.
          const participants = await rooms.listParticipants(c.roomName).catch(() => []);
          const visible = participants.filter((p) => !p.permission?.hidden);
          return {
            id: c.id,
            agentName: agentName.get(c.agentUserId) ?? "Agent",
            leadName: c.leadId ? leadName.get(c.leadId) ?? null : null,
            createdAt: c.createdAt,
            participants: visible.map((p) => ({
              name: p.name || p.identity,
              role: p.identity.startsWith("agent-") ? "agent" : "client",
              joinedAt: Number(p.joinedAt) * 1000,
            })),
          };
        })
      );
      return NextResponse.json(rows);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
