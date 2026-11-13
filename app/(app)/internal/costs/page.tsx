import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenantPage } from "@/lib/withTenant";
import { canSeeCosts } from "@/lib/costs/access";
import { azureBill } from "@/lib/costs/azureBill";
import { storageCostPerMonth } from "@/lib/costs/pricing";
import { CostsPage, type CostsData } from "@/components/costs/CostsPage";

export const dynamic = "force-dynamic";

function monthRange(param: string | undefined) {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const lastDay = new Date(Math.min(end.getTime() - 86400000, now.getTime()));
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const key = (d: Date) => d.toISOString().slice(0, 7);
  return {
    start,
    end,
    key: key(start),
    prev: key(new Date(Date.UTC(year, month - 1, 1))),
    next: end <= now ? key(end) : null,
    from: ymd(start),
    to: ymd(lastDay < start ? start : lastDay),
  };
}

// Internal: what Sphaera costs to run, from the Azure bill down to each
// Janus request and each video call. Not in the menu.
export default async function InternalCostsRoute({ searchParams }: { searchParams: { month?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");
  if (!canSeeCosts(session.user?.email)) notFound();

  return withTenantPage(session, async () => {
    const range = monthRange(searchParams.month);
    const [events, bill, storedRecordings] = await Promise.all([
      prisma.usageEvent.findMany({
        where: { createdAt: { gte: range.start, lt: range.end } },
        orderBy: { createdAt: "desc" },
      }),
      azureBill(range.from, range.to),
      prisma.videoCallRecording.aggregate({ where: { status: "ready" }, _sum: { sizeBytes: true }, _count: true }),
    ]);

    const userIds = [...new Set(events.map((e) => e.userId).filter(Boolean))] as string[];
    const leadIds = [...new Set(events.map((e) => e.leadId).filter(Boolean))] as string[];
    const callIds = [...new Set(events.map((e) => e.callId).filter(Boolean))] as string[];
    const [users, leads, calls] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
      prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } }),
      prisma.videoCall.findMany({
        where: { id: { in: callIds } },
        select: { id: true, createdAt: true, recordings: { select: { durationSec: true, sizeBytes: true } } },
      }),
    ]);

    const storedBytes = storedRecordings._sum.sizeBytes ?? 0;
    const data: CostsData = {
      month: { key: range.key, prev: range.prev, next: range.next },
      bill,
      storage: { recordings: storedRecordings._count, bytes: storedBytes, perMonthUsd: storageCostPerMonth(storedBytes) },
      events: events.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        service: e.service,
        feature: e.feature,
        model: e.model,
        inputTokens: e.inputTokens,
        cachedTokens: e.cachedTokens,
        outputTokens: e.outputTokens,
        quantity: e.quantity,
        costUsd: e.costUsd,
        durationMs: e.durationMs,
        userId: e.userId,
        leadId: e.leadId,
        callId: e.callId,
      })),
      users: Object.fromEntries(users.map((u) => [u.id, u.name || u.email || "User"])),
      leads: Object.fromEntries(leads.map((l) => [l.id, l.name])),
      calls: Object.fromEntries(
        calls.map((c) => [
          c.id,
          {
            at: c.createdAt.toISOString(),
            durationSec: c.recordings.reduce((s, r) => s + (r.durationSec ?? 0), 0) || null,
          },
        ])
      ),
    };
    return <CostsPage data={data} />;
  });
}
