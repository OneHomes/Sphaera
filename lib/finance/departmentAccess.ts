import { prisma } from "../prisma";

// Department-scoped Finance access ("Head of Department" permission
// model). A user with canAccessFinance=true but zero rows here sees
// every department (the existing default). A user with one or more rows
// is restricted to only those departments.

/**
 * Resolves what a user is allowed to see: `null` means unrestricted (no
 * department scoping rows exist — the default for Finance/Admin users),
 * an array means "only these departments."
 */
export async function getUserDepartmentScope(userId: string): Promise<string[] | null> {
  const rows = await prisma.financeDepartmentAccess.findMany({
    where: { userId },
    select: { department: true },
  });
  if (rows.length === 0) return null;
  return rows.map((r) => r.department);
}

export type DepartmentAccessEntry = {
  userId: string;
  userName: string;
  userEmail: string;
  departments: string[];
};

/** Admin view: every Finance-enabled user and which departments (if any) they're scoped to. */
export async function listDepartmentAccess(): Promise<DepartmentAccessEntry[]> {
  const [users, accessRows] = await Promise.all([
    prisma.user.findMany({
      where: { canAccessFinance: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.financeDepartmentAccess.findMany({ select: { userId: true, department: true } }),
  ]);

  const byUser = new Map<string, string[]>();
  for (const row of accessRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row.department);
    byUser.set(row.userId, list);
  }

  return users.map((u) => ({
    userId: u.id,
    userName: u.name,
    userEmail: u.email,
    departments: (byUser.get(u.id) ?? []).sort(),
  }));
}

export type SetDepartmentAccessResult = { ok: true } | { ok: false; status: number; error: string };

/** Replaces a user's full set of allowed departments with exactly the given list (empty = unrestricted). */
export async function setUserDepartmentAccess(params: {
  userId: string;
  departments: string[];
}): Promise<SetDepartmentAccessResult> {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false, status: 404, error: "User not found" };
  if (!user.canAccessFinance) {
    return { ok: false, status: 400, error: "Grant Finance access to this user before scoping it to specific departments." };
  }

  const unique = Array.from(new Set(params.departments.map((d) => d.trim()).filter(Boolean)));

  await prisma.financeDepartmentAccess.deleteMany({ where: { userId: params.userId } });
  if (unique.length > 0) {
    await prisma.financeDepartmentAccess.createMany({
      data: unique.map((department) => ({ userId: params.userId, department })),
    });
  }

  return { ok: true };
}
