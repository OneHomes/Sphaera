import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Soft-delete: the row stays (with removedAt/removedByName set) as the
// tag's own audit history, per the doc's "tag history should retain the
// user and timestamp for audit purposes."
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tag = await prisma.leadTag.findUnique({ where: { id: params.tagId } });
  if (!tag || tag.leadId !== params.id) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (tag.removedAt) {
    return NextResponse.json({ error: "Tag already removed" }, { status: 409 });
  }

  await prisma.leadTag.update({
    where: { id: params.tagId },
    data: {
      removedAt: new Date(),
      removedByName: session.user?.name ?? session.user?.email ?? "Unknown",
    },
  });

  return NextResponse.json({ ok: true });
}
