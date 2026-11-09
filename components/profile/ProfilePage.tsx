import type { Session } from "next-auth";
import { Mail, Shield, User } from "lucide-react";
import { initials } from "@/lib/initials";

export function ProfilePage({ session }: { session: Session | null }) {
  const name = session?.user?.name ?? "Signed-in user";
  const email = session?.user?.email ?? "—";
  const oid = (session?.user as { oid?: string } | undefined)?.oid;

  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Profile</h1>

      <div className="max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-base-700 text-lg font-medium text-ink-50">
            {initials(session?.user?.name) || <User className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-ink-50">{name}</p>
            <p className="text-xs text-ink-500 [overflow-wrap:anywhere]">{email}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-base-700 pt-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex shrink-0 items-center gap-1.5 text-ink-500">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <span className="min-w-0 text-right text-ink-300 [overflow-wrap:anywhere]">{email}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-500">
              <Shield className="h-3.5 w-3.5" />
              Identity provider
            </span>
            <span className="text-ink-300">
              {oid ? "Microsoft Entra ID" : "Testing (email/password)"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-md text-xs text-ink-500">
        Role and permission details (PF02) will appear here once RBAC is
        wired up against Entra ID groups/roles.
      </p>
    </div>
  );
}
