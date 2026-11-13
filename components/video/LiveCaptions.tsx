"use client";

import { useState } from "react";
import { useDataChannel } from "@livekit/components-react";

type Line = { key: number; name: string; role: string; text: string };

const MAX_LINES = 3;
let nextKey = 0;

// Live captions from the Sphaera call bot (services/call-bot), which
// transcribes each speaker and sends every finished sentence on the
// "transcript" data topic. Must sit inside a <LiveKitRoom>.
export function LiveCaptions() {
  const [lines, setLines] = useState<Line[]>([]);

  useDataChannel("transcript", (msg) => {
    try {
      const s = JSON.parse(new TextDecoder().decode(msg.payload));
      if (typeof s.text !== "string" || !s.text.trim()) return;
      setLines((prev) => [...prev, { key: nextKey++, name: String(s.name ?? ""), role: String(s.role ?? ""), text: s.text }].slice(-MAX_LINES));
    } catch {}
  });

  if (!lines.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-10"
    >
      {lines.map((l) => (
        <p key={l.key} className="live-caption mx-auto w-full max-w-3xl text-sm leading-snug text-white" dir="auto">
          <span className={`mr-1.5 font-medium ${l.role === "client" ? "text-sky-300" : "text-emerald-300"}`}>{l.name}:</span>
          {l.text}
        </p>
      ))}
    </div>
  );
}
