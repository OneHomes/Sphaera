import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/aexTransform";
import { PeoplePage } from "@/components/people/PeoplePage";
import type { TeamMember } from "@/lib/peopleData";

export const dynamic = "force-dynamic";

export default async function PeopleRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const users = await prisma.user.findMany({
    include: {
      team: true,
      pointEvents: { select: { points: true } },
    },
    orderBy: { name: "asc" },
  });

  const teamMembers: TeamMember[] = users.map((u) => {
    const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      team: u.team?.name ?? "No team",
      email: u.email,
      tier: tierForPoints(points),
    };
  });

  return <PeoplePage teamMembers={teamMembers} />;
}