"use client";

import { useState } from "react";
import { MessageCircle, CheckCircle2 } from "lucide-react";

type Step = "form" | "otp" | "done";

export function WhatsAppConnect() {
  const [step, setStep] = useState<Step>("form");
  const [countryCode, setCountryCode] = useState("92");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, phoneNumber }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to start connection");
      }

      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the code you received.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Verification failed");
      }

      const data = await res.json();
      setConnectedNumber(data.phoneNumber);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-status-active/30 bg-status-active/10 p-3.5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-status-active" />
        <div>
          <p className="text-sm text-ink-50">WhatsApp connected</p>
          <p className="text-xs text-ink-500">{connectedNumber}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-base-700 bg-base-900 p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-ink-300" />
        <p className="text-sm text-ink-50">Connect your WhatsApp Business number</p>
      </div>

      {step === "form" && (
        <form onSubmit={handleRequestCode} className="flex gap-2">
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="92"
            className="w-14 rounded-lg border border-base-700 bg-base-800 px-2 py-2 text-center text-xs text-ink-50 outline-none"
          />
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="3001234567"
            className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="shrink-0 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyCode} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            className="flex-1 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="shrink-0 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isSubmitting ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}

      <p className="mt-2 text-[11px] text-ink-500">
        {step === "form"
          ? "You'll receive a verification code via SMS or call."
          : "Enter the code sent to your phone."}
      </p>
    </div>
  );
}