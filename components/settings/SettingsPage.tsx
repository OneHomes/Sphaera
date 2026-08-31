"use client";

import { useState } from "react";
import { WhatsAppConnect } from "./WhatsAppConnect";
type ToggleSetting = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

const initialSettings: ToggleSetting[] = [
  { id: "notif-new-lead", label: "New lead notifications", description: "Alert me when a new lead is assigned", enabled: true },
  { id: "notif-overdue", label: "Overdue task alerts", description: "Alert me when a task or lead action is overdue", enabled: true },
  { id: "notif-aex", label: "AEX updates", description: "Notify me on tier changes, badges, and challenge progress", enabled: true },
  { id: "janus-suggestions", label: "Janus suggested prompts", description: "Show suggested questions on the command center", enabled: true },
  { id: "conversation-intelligence", label: "Conversation intelligence (beta)", description: "Enable live sentiment/tone indicators on calls — beta, per PRD JN07 caution", enabled: false },
];

export function SettingsPage() {
  const [settings, setSettings] = useState(initialSettings);

  function toggle(id: string) {
    // TODO: persist to Configuration and Feature Flags (PF10) once an
    // admin/config API exists.
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">Settings</h1>
      <p className="mb-5 text-sm text-ink-500">
        Notification and feature preferences.
      </p>

      <div className="max-w-xl space-y-2">
        <WhatsAppConnect />
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center justify-between rounded-lg border border-base-700 bg-base-900 p-3.5"
          >
            <div>
              <p className="text-sm text-ink-50">{setting.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {setting.description}
              </p>
            </div>
            <button
              onClick={() => toggle(setting.id)}
              aria-pressed={setting.enabled}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                setting.enabled ? "bg-status-active" : "bg-base-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                  setting.enabled ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
