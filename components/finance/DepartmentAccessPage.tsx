"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type FinanceUser = {
  id: string;
  name: string;
  email: string;
  canAccessFinance: boolean;
  canAccessFinancePayroll: boolean;
};

export function DepartmentAccessPage() {
  const [users, setUsers] = useState<FinanceUser[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [scopeByUser, setScopeByUser] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, stateRes, accessRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/finance/ledger/state"),
        fetch("/api/finance/admin/department-access"),
      ]);
      if (!usersRes.ok || !stateRes.ok || !accessRes.ok) {
        throw new Error("Failed to load department access data");
      }
      const usersData: FinanceUser[] = await usersRes.json();
      const stateData: { departments: string[] } = await stateRes.json();
      const accessData: { entries: { userId: string; departments: string[] }[] } = await accessRes.json();

      setUsers(usersData);
      setDepartments(stateData.departments);
      setScopeByUser(
        Object.fromEntries(accessData.entries.map((e) => [e.userId, e.departments]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function patchUser(userId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to update user");
  }

  async function handleFinanceAccessToggle(userId: string, canAccessFinance: boolean) {
    setSavingUserId(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, canAccessFinance } : u)));
    try {
      await patchUser(userId, { canAccessFinance });
      if (!canAccessFinance) {
        // Revoking Finance access also clears any department scoping —
        // otherwise a re-grant later would silently restore a stale scope.
        await fetch("/api/finance/admin/department-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, departments: [] }),
        });
        setScopeByUser((prev) => ({ ...prev, [userId]: [] }));
      }
    } catch (err) {
      console.error(err);
      loadData();
    } finally {
      setSavingUserId(null);
    }
  }

  async function handlePayrollToggle(userId: string, canAccessFinancePayroll: boolean) {
    setSavingUserId(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, canAccessFinancePayroll } : u)));
    try {
      await patchUser(userId, { canAccessFinancePayroll });
    } catch (err) {
      console.error(err);
      loadData();
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleDepartmentToggle(userId: string, department: string, checked: boolean) {
    const current = scopeByUser[userId] ?? [];
    const next = checked ? [...current, department] : current.filter((d) => d !== department);
    setScopeByUser((prev) => ({ ...prev, [userId]: next }));
    setSavingUserId(userId);
    try {
      const res = await fetch("/api/finance/admin/department-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, departments: next }),
      });
      if (!res.ok) throw new Error("Failed to update department access");
    } catch (err) {
      console.error(err);
      loadData();
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-status-inactive">{error}</div>;
  }

  const financeUsers = users.filter((u) => u.canAccessFinance);
  const otherUsers = users.filter((u) => !u.canAccessFinance);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-ink-300" />
        <h1 className="text-xl font-semibold text-ink-50">Department Access</h1>
      </div>
      <p className="mb-5 text-xs text-ink-500 max-w-2xl">
        Grant Finance access to a Head of Department, then tick the departments they should be able to see cost
        data for. A user with no departments ticked sees every department (the default). Payroll access
        additionally unlocks People Costs and full backup/restore.
      </p>

      <WidgetCard title="Finance-enabled users" className="mb-6">
        {financeUsers.length === 0 ? (
          <p className="py-3 text-center text-xs text-ink-500">No users have Finance access yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="pb-2 pr-3 font-normal">Name</th>
                <th className="pb-2 pr-3 font-normal">Email</th>
                <th className="pb-2 pr-3 font-normal text-center">Finance</th>
                <th className="pb-2 pr-3 font-normal text-center">Payroll</th>
                <th className="pb-2 font-normal">Departments (none = all)</th>
              </tr>
            </thead>
            <tbody>
              {financeUsers.map((user) => {
                const scope = scopeByUser[user.id] ?? [];
                const saving = savingUserId === user.id;
                return (
                  <tr key={user.id} className="border-t border-base-700 align-top text-ink-300">
                    <td className="py-2.5 pr-3 font-medium text-ink-50">{user.name}</td>
                    <td className="py-2.5 pr-3 text-ink-500">{user.email}</td>
                    <td className="py-2.5 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canAccessFinance}
                        disabled={saving}
                        onChange={(e) => handleFinanceAccessToggle(user.id, e.target.checked)}
                        aria-label={`Finance access for ${user.name}`}
                        className="h-3.5 w-3.5 accent-status-active disabled:opacity-50"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canAccessFinancePayroll}
                        disabled={saving}
                        onChange={(e) => handlePayrollToggle(user.id, e.target.checked)}
                        aria-label={`Payroll access for ${user.name}`}
                        className="h-3.5 w-3.5 accent-status-active disabled:opacity-50"
                      />
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {departments.map((dept) => (
                          <label key={dept} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                            <input
                              type="checkbox"
                              checked={scope.includes(dept)}
                              disabled={saving}
                              onChange={(e) => handleDepartmentToggle(user.id, dept, e.target.checked)}
                              className="h-3 w-3 accent-status-active disabled:opacity-50"
                            />
                            {dept}
                          </label>
                        ))}
                      </div>
                      {scope.length === 0 && (
                        <p className="mt-1 text-[10px] text-ink-500">Unrestricted — sees all departments.</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </WidgetCard>

      <WidgetCard title="Grant Finance access">
        {otherUsers.length === 0 ? (
          <p className="py-3 text-center text-xs text-ink-500">Every user already has Finance access.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="pb-2 pr-3 font-normal">Name</th>
                <th className="pb-2 pr-3 font-normal">Email</th>
                <th className="pb-2 font-normal text-center">Grant access</th>
              </tr>
            </thead>
            <tbody>
              {otherUsers.map((user) => (
                <tr key={user.id} className="border-t border-base-700 text-ink-300">
                  <td className="py-2.5 pr-3 font-medium text-ink-50">{user.name}</td>
                  <td className="py-2.5 pr-3 text-ink-500">{user.email}</td>
                  <td className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={savingUserId === user.id}
                      onChange={(e) => handleFinanceAccessToggle(user.id, e.target.checked)}
                      aria-label={`Finance access for ${user.name}`}
                      className="h-3.5 w-3.5 accent-status-active disabled:opacity-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </WidgetCard>
    </div>
  );
}
