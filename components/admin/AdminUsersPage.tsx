"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plus, AlertTriangle, X, Sparkles, Download } from "lucide-react";
import { WhatsAppConfigCard } from "./WhatsAppConfigCard";
import { SalesforceSyncCard } from "./SalesforceSyncCard";
import { AexConfigPanel } from "./AexConfigPanel";
import { JanusCoachingCard } from "@/components/aex/JanusCoachingCard";
import { downloadCsv } from "@/lib/csv";
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "AGENT" | "MANAGER" | "ADMIN";
  teamId: string | null;
  teamName: string | null;
  createdAt: string;
  activeLeadCount: number;
  activeOpportunityCount: number;
};

type Team = {
  id: string;
  name: string;
  managerName: string | null;
  memberCount: number;
};

type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  details: string;
  createdAt: string;
};

const roleStyles: Record<AdminUser["role"], string> = {
  ADMIN: "bg-tier-gold/15 text-tier-gold",
  MANAGER: "bg-sky-500/15 text-sky-400",
  AGENT: "bg-base-700 text-ink-300",
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Real caps from AexConfig (PRD AV10) — no more hardcoded mirror.
  const [maxActiveLeads, setMaxActiveLeads] = useState(15);
  const [maxActiveOpportunities, setMaxActiveOpportunities] = useState(15);
  const [newTeamName, setNewTeamName] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [coachingUser, setCoachingUser] = useState<{ id: string; name: string } | null>(null);
  const [auditSearch, setAuditSearch] = useState("");

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, teamsRes, auditRes, aexConfigRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/teams"),
        fetch("/api/admin/audit-log"),
        fetch("/api/admin/aex-config"),
      ]);

      if (!usersRes.ok || !teamsRes.ok || !auditRes.ok) {
        throw new Error("Failed to load admin data");
      }

      setUsers(await usersRes.json());
      setTeams(await teamsRes.json());
      setAuditEntries(await auditRes.json());
      if (aexConfigRes.ok) {
        const aexConfig = await aexConfigRes.json();
        setMaxActiveLeads(aexConfig.maxActiveLeadAssignments);
        setMaxActiveOpportunities(aexConfig.maxActiveOpportunityAssignments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // PF07 acceptance criterion — "authorised administrators can search and
  // export audit events." Debounced, separate from loadData() so typing
  // doesn't re-fetch users/teams/AEX config on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch(`/api/admin/audit-log?search=${encodeURIComponent(auditSearch)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then(setAuditEntries)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [auditSearch]);

  async function handleRoleChange(userId: string, role: AdminUser["role"]) {
    setSavingUserId(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
    } catch (err) {
      console.error(err);
      loadData();
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleTeamChange(userId: string, teamId: string) {
    setSavingUserId(userId);
    const team = teams.find((t) => t.id === teamId);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, teamId: teamId || null, teamName: team?.name ?? null }
          : u
      )
    );
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: teamId || null }),
      });
      if (!res.ok) throw new Error("Failed to update team");
    } catch (err) {
      console.error(err);
      loadData();
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim() || isCreatingTeam) return;
    setIsCreatingTeam(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create team");
      setNewTeamName("");
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingTeam(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-status-inactive">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-ink-300" />
        <h1 className="text-xl font-semibold text-ink-50">Admin — Users & Teams</h1>
      </div>
<WhatsAppConfigCard />
      <SalesforceSyncCard />
      <AexConfigPanel />
      <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-50">Teams</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {teams.map((team) => (
            <span
              key={team.id}
              className="rounded-full border border-base-700 bg-base-800 px-3 py-1 text-xs text-ink-300"
            >
              {team.name} ({team.memberCount} members
              {team.managerName ? `, managed by ${team.managerName}` : ""})
            </span>
          ))}
          {teams.length === 0 && (
            <span className="text-xs text-ink-500">No teams yet.</span>
          )}
        </div>
        <form onSubmit={handleCreateTeam} className="flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team name…"
            className="flex-1 max-w-xs rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={isCreatingTeam}
            className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
          >
            <Plus className="h-3 w-3" />
            Add team
          </button>
        </form>
      </div>

      <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Users</h2>
          <button
            onClick={() =>
              downloadCsv(
                "sphaera-users.csv",
                ["Name", "Email", "Role", "Team", "Active Leads", "Active Opportunities"],
                users.map((u) => [u.name, u.email, u.role, u.teamName ?? "", u.activeLeadCount, u.activeOpportunityCount])
              )
            }
            className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>
        <p className="mb-3 text-[11px] text-ink-500">
          Active lead/opportunity counts highlight in red if an agent is at
          or above the fair-allocation cap ({maxActiveLeads}{" "}
          leads / {maxActiveOpportunities} opportunities, configurable
          below) — PRD R08.
        </p>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal">Email</th>
              <th className="pb-2 pr-3 font-normal">Role</th>
              <th className="pb-2 pr-3 font-normal">Team</th>
              <th className="pb-2 pr-3 font-normal text-right">Active leads</th>
              <th className="pb-2 pr-3 font-normal text-right">Active opps</th>
              <th className="pb-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const leadOverCap = user.activeLeadCount >= maxActiveLeads;
              const oppOverCap =
                user.activeOpportunityCount >= maxActiveOpportunities;
              return (
                <tr key={user.id} className="border-t border-base-700 text-ink-300">
                  <td className="py-2.5 pr-3 font-medium text-ink-50">
                    {user.name}
                  </td>
                  <td className="py-2.5 pr-3 text-ink-500">{user.email}</td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={user.role}
                      disabled={savingUserId === user.id}
                      onChange={(e) =>
                        handleRoleChange(
                          user.id,
                          e.target.value as AdminUser["role"]
                        )
                      }
                      className={`rounded-full border-0 px-2 py-1 text-[11px] font-medium outline-none disabled:opacity-50 ${roleStyles[user.role]}`}
                    >
                      <option value="AGENT">AGENT</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={user.teamId ?? ""}
                      disabled={savingUserId === user.id}
                      onChange={(e) => handleTeamChange(user.id, e.target.value)}
                      className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-[11px] text-ink-300 outline-none disabled:opacity-50"
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right ${leadOverCap ? "font-semibold text-status-inactive" : ""}`}
                  >
                    {user.activeLeadCount}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right ${oppOverCap ? "font-semibold text-status-inactive" : ""}`}
                  >
                    {user.activeOpportunityCount}
                  </td>
                  <td className="py-2.5 text-right">
                    {user.role === "AGENT" && (
                      <button
                        onClick={() => setCoachingUser({ id: user.id, name: user.name })}
                        className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                      >
                        <Sparkles className="h-3 w-3" />
                        Coach
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {coachingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setCoachingUser(null)}
                className="rounded-full bg-base-800 p-1.5 text-ink-300 hover:text-ink-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <JanusCoachingCard userId={coachingUser.id} userName={coachingUser.name} />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-ink-300" />
            <h2 className="text-sm font-medium text-ink-50">
              Governance Log
            </h2>
          </div>
          <a
            href={`/api/admin/audit-log?format=csv&search=${encodeURIComponent(auditSearch)}`}
            className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </a>
        </div>
        <p className="mb-3 text-[11px] text-ink-500">
          Role/team changes and blocked AEX point-award attempts (PRD
          Section 14.12 — Anti Gaming and Governance). Export includes every
          matching event, not just what&apos;s shown below.
        </p>
        <input
          value={auditSearch}
          onChange={(e) => setAuditSearch(e.target.value)}
          placeholder="Search action, actor, or details…"
          className="mb-3 w-full rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500 focus:border-base-600"
        />
        <div className="space-y-2">
          {auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-base-700 bg-base-800 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-50">{entry.action}</span>
                <span className="text-[10px] text-ink-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-ink-300">{entry.details}</p>
              <p className="mt-0.5 text-[10px] text-ink-500">
                by {entry.actorEmail}
              </p>
            </div>
          ))}
          {auditEntries.length === 0 && (
            <p className="py-3 text-center text-xs text-ink-500">
              No governance events yet.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-500">
        Role and team changes are recorded in the audit log (PF07). Changes
        take effect for a user the next time they sign in.
      </p>
    </div>
  );
}