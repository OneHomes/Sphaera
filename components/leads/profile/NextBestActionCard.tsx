"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Phone, CalendarClock, MessageSquareText } from "lucide-react";
import type { NextBestAction } from "@/lib/nextBestAction";
import { LogInteractionModal } from "./LogInteractionModal";
import { ComposeMessageModal } from "./ComposeMessageModal";

const actionIcons = {
  call: Phone,
  email: MessageSquareText,
  meeting: CalendarClock,
  nurture: MessageSquareText,
  none: Compass,
};

export function NextBestActionCard({
  leadId,
  nba,
}: {
  leadId: string;
  nba: NextBestAction;
}) {
  const router = useRouter();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);

  const Icon = actionIcons[nba.action];

  function handleCta() {
    if (nba.action === "call") {
      router.push(`/calls/${leadId}`);
    } else if (nba.action === "meeting") {
      setShowLogModal(true);
    } else if (nba.action === "email" || nba.action === "nurture") {
      setShowComposeModal(true);
    }
  }

  return (
    <div className="rounded-xl border border-status-active/30 bg-status-active/5 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-50">
        <Compass className="h-4 w-4 text-status-active" />
        Next best action
      </h3>
      <p className="flex items-center gap-2 text-sm font-medium text-status-active">
        <Icon className="h-3.5 w-3.5" />
        {nba.label}
      </p>
      <p className="mt-1 text-xs text-ink-500">{nba.reason}</p>
      <p className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-600">
        <span
          className={`rounded-full px-1.5 py-0.5 ${
            nba.confidence === "High"
              ? "bg-status-active/15 text-status-active"
              : "bg-status-alert/15 text-status-alert"
          }`}
        >
          {nba.confidence} confidence
        </span>
        <span>{nba.sourcePeriod}</span>
      </p>

      {nba.action !== "none" && (
        <button
          onClick={handleCta}
          className="mt-3 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 transition hover:border-base-600 hover:text-ink-50"
        >
          {nba.action === "call" && "Start call"}
          {nba.action === "meeting" && "Log this meeting"}
          {(nba.action === "email" || nba.action === "nurture") && "Draft with Janus"}
        </button>
      )}

      {showLogModal && (nba.action === "call" || nba.action === "meeting") && (
        <LogInteractionModal
          leadId={leadId}
          defaultType={nba.action}
          onClose={() => setShowLogModal(false)}
          onLogged={() => router.refresh()}
        />
      )}

      {showComposeModal && (
        <ComposeMessageModal
          leadId={leadId}
          objective={nba.reason}
          onClose={() => setShowComposeModal(false)}
          onSent={() => router.refresh()}
        />
      )}
    </div>
  );
}
