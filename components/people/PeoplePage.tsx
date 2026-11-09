import { Mail, User } from "lucide-react";
import type { Tier } from "@/lib/businessActivityData";
import type { TeamMember } from "@/lib/peopleData";
import { initials } from "@/lib/initials";
import { plural } from "@/lib/plural";

const tierStyles: Record<Tier, string> = {
  Gold: "bg-tier-gold/15 text-tier-gold",
  Silver: "bg-tier-silver/15 text-tier-silver",
  Bronze: "bg-tier-bronze/15 text-tier-bronze",
};

export function PeoplePage({ teamMembers }: { teamMembers: TeamMember[] }) {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">People</h1>
      <p className="mb-5 text-sm text-ink-500">
        {plural(teamMembers.length, "team member")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="rounded-xl border border-base-700 bg-base-900 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-700 text-sm font-medium text-ink-50">
                {initials(member.name) || <User className="h-4 w-4" />}
              </div>
              <span
                className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tierStyles[member.tier]}`}
              >
                {member.tier}
              </span>
            </div>
            <p className="mt-3 break-words text-sm font-medium text-ink-50">
              {member.name}
            </p>
            <p className="text-xs text-ink-500">{member.role}</p>
            <p className="mt-1 text-xs text-ink-500">{member.team}</p>
            <div className="mt-3 flex items-center gap-1.5 border-t border-base-700 pt-2 text-xs text-ink-300">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate" title={member.email}>{member.email}</span>
            </div>
          </div>
        ))}

        {teamMembers.length === 0 && (
          <p className="text-sm text-ink-500">No team members yet.</p>
        )}
      </div>
    </div>
  );
}