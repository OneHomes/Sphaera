"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

// HARDENING NOTE: the temporary email/password testing form has been
// removed along with the Credentials provider in lib/auth.ts. Microsoft
// Entra ID is now the only sign-in method, per PRD PF01.
export function SignInForm() {
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);

  async function handleMicrosoftSignIn() {
    setIsMicrosoftLoading(true);
    try {
      await signIn("azure-ad", { callbackUrl: "/onboarding" });
    } finally {
      setIsMicrosoftLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-16 md:w-1/2 lg:px-24">
      <div className="mb-10 flex items-center gap-2">
        <SphaeraMark className="h-6 w-6 text-ink-50" />
        <span className="font-display text-lg font-semibold tracking-tight text-ink-50">
          SPHAERA
        </span>
      </div>

      <h1 className="font-display text-3xl font-semibold text-ink-50">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-ink-300">
        Sign in with your One Homes Microsoft account to continue.
      </p>

      <button
        type="button"
        onClick={handleMicrosoftSignIn}
        disabled={isMicrosoftLoading}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-base-600 bg-base-900 py-2.5 text-sm font-medium text-ink-50 transition hover:bg-base-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isMicrosoftLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MicrosoftMark className="h-4 w-4" />
        )}
        Sign in with Microsoft
      </button>

      <p className="mt-8 text-center text-sm text-ink-300">
        Need access? Contact your Sphaera administrator.
      </p>
    </div>
  );
}

function SphaeraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 17c0-2.5 2-5 3.5-5M19 17c0-2.5-2-5-3.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicrosoftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}