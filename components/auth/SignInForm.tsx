"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TEMPORARY testing path — accepts any non-empty email/password via the
  // Credentials provider added in lib/auth.ts. Remove alongside that
  // provider before UAT/production; Microsoft is the real auth method.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Couldn't sign you in. Try again.");
      } else if (result?.ok) {
        window.location.href = "/onboarding";
      }
    } finally {
      setIsSubmitting(false);
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
        Please sign in to continue to your account.
      </p>

      <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-xs text-status-alert">
        Testing mode: any email + password combination signs you in. Remove
        before UAT/production — see lib/auth.ts.
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-ink-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-base-600 bg-base-900 px-3.5 py-2.5 text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-status-active"
            placeholder="you@onehomes.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-ink-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-900 px-3.5 py-2.5 pr-10 text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-status-active"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            checked={keepLoggedIn}
            onChange={(e) => setKeepLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border-base-600 bg-base-900 accent-status-active"
          />
          Keep me logged in
        </label>

        {error && (
          <p role="alert" className="text-sm text-status-inactive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-ink-50 py-2.5 text-sm font-semibold text-base-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-base-600" />
        <span className="text-xs text-ink-500">or</span>
        <div className="h-px flex-1 bg-base-600" />
      </div>

      <button
        type="button"
        onClick={handleMicrosoftSignIn}
        disabled={isMicrosoftLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-600 bg-base-900 py-2.5 text-sm font-medium text-ink-50 transition hover:bg-base-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isMicrosoftLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MicrosoftMark className="h-4 w-4" />
        )}
        Sign in with Microsoft
      </button>

      <p className="mt-8 text-center text-sm text-ink-300">
        Need an account?{" "}
        <a href="#" className="font-medium text-status-active hover:underline">
          Create one
        </a>
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
