import type { Session } from "next-auth";
import { Mail, Shield } from "lucide-react";

export function ProfilePage({ session }: { session: Session | null }) {
  const name = session?.user?.name ?? "Signed-in user";
  const email = session?.user?.email ?? "—";
  const oid = (session?.user as { oid?: string } | undefined)?.oid;

  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Profile</h1>

      <div className="max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-base-700 text-lg font-medium text-ink-50">
            {name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-ink-50">{name}</p>
            <p className="text-xs text-ink-500">{email}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-base-700 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-500">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <span className="text-ink-300">{email}</span>
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
