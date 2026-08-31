"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

type ConnectedNumber = {
  id: string;
  userName: string;
  phoneNumber: string;
  verifiedAt: string | null;
};

type WhatsAppConfigData = {
  id: string;
  businessName: string;
  isVerified: boolean;
  hasToken: boolean;
  connectedNumbers: ConnectedNumber[];
};

export function WhatsAppConfigCard() {
  const [config, setConfig] = useState<WhatsAppConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [systemUserToken, setSystemUserToken] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/whatsapp-config")
      .then((res) => (res.ok ? res.json() : null))
      .then(setConfig)
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!wabaId || !metaAppId || !systemUserToken || !businessName) {
      setError("All fields are required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/whatsapp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wabaId, metaAppId, systemUserToken, businessName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save configuration");
      }

      const refreshed = await fetch("/api/admin/whatsapp-config");
      setConfig(await refreshed.json());
      setShowForm(false);
      setSystemUserToken(""); // never keep the raw token in local state longer than needed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
        <p className="text-xs text-ink-500">Loading WhatsApp setup…</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-ink-300" />
        <h2 className="text-sm font-medium text-ink-50">WhatsApp Business</h2>
      </div>

      {config ? (
        <>
          <p className="mb-3 text-xs text-ink-300">
            Connected to <span className="text-ink-50">{config.businessName}</span>
          </p>
          <div className="mb-3 space-y-1.5">
            {config.connectedNumbers.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs"
              >
                <span className="text-ink-50">{n.userName}</span>
                <span className="text-ink-500">
                  {n.phoneNumber} {n.verifiedAt ? "· Verified" : "· Pending"}
                </span>
              </div>
            ))}
            {config.connectedNumbers.length === 0 && (
              <p className="text-xs text-ink-500">
                No agents have connected their number yet — they can do this
                from their own Settings page.
              </p>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-ink-500 hover:text-ink-300"
          >
            Update configuration
          </button>
        </>
      ) : (
        <p className="mb-3 text-xs text-ink-500">
          Not set up yet. Complete Meta Business Verification and generate a
          permanent System User token first (see setup guide), then enter
          the details below.
        </p>
      )}

      {(showForm || !config) && (
        <form onSubmit={handleSave} className="mt-3 space-y-2">
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name (e.g. One Homes)"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="WhatsApp Business Account ID"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            value={metaAppId}
            onChange={(e) => setMetaAppId(e.target.value)}
            placeholder="Meta App ID"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
          <input
            type="password"
            value={systemUserToken}
            onChange={(e) => setSystemUserToken(e.target.value)}
            placeholder="Permanent System User access token"
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />

          {error && <p className="text-xs text-status-inactive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}