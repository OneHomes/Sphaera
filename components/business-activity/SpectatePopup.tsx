"use client";

import { Headphones, X } from "lucide-react";

export function SpectatePopup({
  agentName,
  clientName,
  onSpectate,
  onClose,
}: {
  agentName: string;
  clientName: string;
  onSpectate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-base-700 text-sm font-medium text-ink-50">
            {agentName.charAt(0)}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-ink-300">
          <span className="font-medium text-ink-50">{agentName}</span> is on a
          call with <span className="text-ink-50">{clientName}</span>, would
          you like to listen in on their call and give them pointers?
        </p>
        <button
          onClick={onSpectate}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-status-active py-2 text-xs font-semibold text-base-950 hover:brightness-110"
        >
          <Headphones className="h-3.5 w-3.5" />
          Spectate now
        </button>
      </div>
    </div>
  );
}
