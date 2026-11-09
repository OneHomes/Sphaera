"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, AlertTriangle } from "lucide-react";

// NextAuth's own error codes (no pages.error configured in lib/auth.ts,
// so it defaults to redirecting back here as /sign-in?error=CODE on any
// failure) — https://next-auth.js.org/configuration/pages#sign-in-page
const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Couldn't start the Microsoft sign-in request. Check the Azure AD client ID/tenant ID are set correctly.",
  OAuthCallback: "Microsoft rejected the callback. Almost always a redirect URI mismatch — check the App Registration's Redirect URIs include this exact domain's /api/auth/callback/azure-ad, and that NEXTAUTH_URL matches this domain exactly.",
  OAuthCreateAccount: "Couldn't create an account from your Microsoft profile.",
  Callback: "Something failed inside the sign-in callback itself — check server logs.",
  AccessDenied: "Access was denied — this account may not be permitted to sign in.",
  Configuration: "Server misconfiguration — check AZURE_AD_CLIENT_ID/CLIENT_SECRET/TENANT_ID and NEXTAUTH_SECRET are all set in this environment.",
  Default: "Sign-in failed for an unspecified reason.",
};

// Microsoft Entra ID is the sign-in method in production (PRD PF01).
// `passwordLogin` is only true on previews/localhost with
// STAGING_LOGIN_PASSWORD set (lib/stagingLogin.ts), so reviewers can get
// in without each preview URL being an Entra redirect URI.
export function SignInForm({ passwordLogin = false }: { passwordLogin?: boolean }) {
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsPasswordLoading(true);
    setPasswordError(null);
    try {
      // redirect: false, then navigate on this origin: on a preview,
      // NEXTAUTH_URL may still point at production, and NextAuth's own
      // redirect would send the browser there.
      const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (res?.ok && !res.error) {
        window.location.href = "/onboarding";
        return;
      }
      setPasswordError("That email and password didn't match.");
    } finally {
      setIsPasswordLoading(false);
    }
  }

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

      {errorCode && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-3 text-xs text-ink-50">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-inactive" />
          <div>
            <p className="font-medium">Sign-in failed: {errorCode}</p>
            <p className="mt-1 text-ink-300">
              {ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default}
            </p>
          </div>
        </div>
      )}

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

      {passwordLogin && (
        <form onSubmit={handlePasswordSignIn} className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-base-700" />
            Staging: sign in with email
            <span className="h-px flex-1 bg-base-700" />
          </div>
          <input
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@onehomes.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-500 focus:border-status-active focus:outline-none"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Staging password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-500 focus:border-status-active focus:outline-none"
          />
          {passwordError && <p className="text-xs text-status-inactive">{passwordError}</p>}
          <button
            type="submit"
            disabled={isPasswordLoading || !email.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-status-active py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPasswordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      )}

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