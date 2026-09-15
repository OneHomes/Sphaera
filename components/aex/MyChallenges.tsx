"use client";

import { useEffect, useState } from "react";
import { Swords, Check, X } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type ChallengeRow = {
  id: string;
  challengerName: string;
  opponentName: string;
  status: string;
  periodEnd: string;
  isMine: boolean;
};

const statusStyles: Record<string, string> = {
  Pending: "bg-status-alert/15 text-status-alert",
  Active: "bg-status-active/15 text-status-active",
  Declined: "bg-base-700 text-ink-500",
  ChallengerWon: "bg-tier-gold/15 text-tier-gold",
  OpponentWon: "bg-tier-gold/15 text-tier-gold",
  Draw: "bg-base-700 text-ink-300",
};

export function MyChallenges() {
  const [challenges, setChallenges] = useState<ChallengeRow[] | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  function load() {
    fetch("/api/aex/challenges")
      .then((res) => (res.ok ? res.json() : []))
      .then(setChallenges);
  }

  useEffect(load, []);

  async function respond(id: string, action: "accept" | "decline") {
    setRespondingId(id);
    try {
      await fetch(`/api/aex/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      load();
    } finally {
      setRespondingId(null);
    }
  }

  function resultLabel(c: ChallengeRow): string {
    if (c.status === "ChallengerWon") return c.isMine ? "You won" : `${c.challengerName} won`;
    if (c.status === "OpponentWon") return c.isMine ? `${c.opponentName} won` : "You won";
    if (c.status === "Draw") return "Draw";
    return c.status;
  }

  return (
    <WidgetCard title="My Challenges" icon={Swords}>
      {challenges === null ? (
        <p className="py-3 text-center text-xs text-ink-500">Loading…</p>
      ) : challenges.length === 0 ? (
        <p className="py-3 text-center text-xs text-ink-500">
          No challenges yet — pick a challenger above.
        </p>
      ) : (
        <div className="space-y-2">
          {challenges.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800 p-2.5 text-xs"
            >
              <div>
                <p className="text-ink-50">
                  {c.challengerName} <span className="text-ink-500">vs</span> {c.opponentName}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-500">
                  {c.status === "Pending" || c.status === "Active"
                    ? `Ends ${new Date(c.periodEnd).toLocaleDateString()}`
                    : resultLabel(c)}
                </p>
              </div>

              {c.status === "Pending" && !c.isMine ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => respond(c.id, "accept")}
                    disabled={respondingId === c.id}
                    aria-label="Accept"
                    className="rounded-full bg-status-active/15 p-1.5 text-status-active hover:bg-status-active/25 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => respond(c.id, "decline")}
                    disabled={respondingId === c.id}
                    aria-label="Decline"
                    className="rounded-full bg-status-inactive/15 p-1.5 text-status-inactive hover:bg-status-inactive/25 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[c.status] ?? "bg-base-700 text-ink-300"}`}
                >
                  {c.status === "Pending" ? "Awaiting response" : c.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
