"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus, X } from "lucide-react";
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
  const blankForm = { name: "", email: "", canAccessFinancePayroll: false, departments: [] as string[] };
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(blankForm);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function openAddForm() {
    setAddForm(blankForm);
    setAddError(null);
    setAddOpen(true);
  }

  async function submitAddForm(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/finance/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to add user");
      setAddOpen(false);
      await loadData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setAdding(false);
    }
  }

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
  const fieldClass =
    "mt-1 w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-base-600 focus:outline-none";

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

      <WidgetCard
        title="Finance-enabled users"
        className="mb-6"
        action={
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1 rounded-lg bg-status-active px-3 py-1.5 text-xs font-medium text-base-950 hover:opacity-90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add user
          </button>
        }
      >
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

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !adding && setAddOpen(false)}>
          <form
            onSubmit={submitAddForm}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-50">Add user</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-ink-500 hover:text-ink-300" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-ink-500">
                Full name
                <input
                  value={addForm.name}
                  maxLength={160}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Aqib Hassan"
                  className={fieldClass}
                  autoFocus
                />
              </label>
              <label className="block text-xs text-ink-500">
                Email (their Microsoft sign-in)
                <input
                  type="email"
                  value={addForm.email}
                  maxLength={200}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="name@onehomes.com"
                  className={fieldClass}
                />
              </label>
              <div>
                <p className="mb-1.5 text-xs text-ink-500">Access</p>
                <label className="flex items-center gap-2 text-xs text-ink-300">
                  <input type="checkbox" checked disabled className="h-3.5 w-3.5 accent-status-active" />
                  Finance
                </label>
                <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-300">
                  <input
                    type="checkbox"
                    checked={addForm.canAccessFinancePayroll}
                    onChange={(e) => setAddForm({ ...addForm, canAccessFinancePayroll: e.target.checked })}
                    className="h-3.5 w-3.5 accent-status-active"
                  />
                  Payroll (People Costs, Payroll Import, backups)
                </label>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-ink-500">Departments (none ticked = all departments)</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {departments.map((dept) => (
                    <label key={dept} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                      <input
                        type="checkbox"
                        checked={addForm.departments.includes(dept)}
                        onChange={(e) =>
                          setAddForm({
                            ...addForm,
                            departments: e.target.checked ? [...addForm.departments, dept] : addForm.departments.filter((d) => d !== dept),
                          })
                        }
                        className="h-3 w-3 accent-status-active"
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>
              {addError && <p className="text-xs text-status-inactive">{addError}</p>}
              <p className="text-[11px] text-ink-500">
                If this email already has a Sphaera account, it keeps its role and just gets this Finance access.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding || addForm.name.trim().length < 2 || !addForm.email.trim()}
                className="rounded-lg bg-status-active px-4 py-1.5 text-xs font-medium text-base-950 hover:opacity-90 disabled:opacity-40"
              >
                {adding ? "Adding…" : "Add user"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
