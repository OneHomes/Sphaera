import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser } from "@/lib/authz";
import { toUiUnit } from "@/lib/inventoryData";
import { InventoryPage as InventoryPageComponent } from "@/components/inventory/InventoryPage";

export const dynamic = "force-dynamic";

export default async function InventoryRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  const authUser = await getFreshAuthUser(session);

  const [projects, units] = await Promise.all([
    prisma.project.findMany({
      include: { _count: { select: { units: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      include: { project: true, paymentPlan: true },
      orderBy: [{ project: { name: "asc" } }, { unitNumber: "asc" }],
    }),
  ]);

  return (
    <InventoryPageComponent
      initialProjects={projects.map((p) => ({ id: p.id, name: p.name, unitCount: p._count.units }))}
      initialUnits={units.map(toUiUnit)}
      isAdmin={authUser.role === "ADMIN"}
    />
  );
}
