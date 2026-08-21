"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ userName }: { userName: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      className="flex shrink-0 items-center gap-2 rounded-full border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 transition hover:border-base-600 hover:text-ink-50"
      title="Sign out"
    >
      <span className="max-w-[10rem] truncate">{userName}</span>
      <LogOut className="h-3.5 w-3.5" />
    </button>
  );
}
