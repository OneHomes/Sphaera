"use client";

import { useEffect, useState } from "react";
import { PhoneOff, Video } from "lucide-react";
import { SphaeraWordmark } from "@/components/brand/SphaeraWordmark";

// Covers a call screen while it connects or ends, so the user sees a
// deliberate "connecting…" moment instead of an empty black video area.
// Fades out (not cut) once `visible` turns false, then unmounts.
export function CallSplash({ visible, label, ending = false }: { visible: boolean; label: string; ending?: boolean }) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [visible]);

  if (!mounted) return null;

  const Icon = ending ? PhoneOff : Video;

  return (
    <div
      role="status"
      aria-live="polite"
      data-visible={visible}
      className="call-splash absolute inset-0 z-20 flex flex-col items-center justify-center gap-7 bg-base-950"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="call-ripple absolute inset-0 rounded-full border border-ink-50/25" />
        <span className="call-ripple call-ripple-late absolute inset-0 rounded-full border border-ink-50/25" />
        <span
          className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
            ending ? "bg-status-inactive/15 text-status-inactive" : "bg-ink-50/10 text-ink-50"
          }`}
        >
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <SphaeraWordmark className="h-5 text-ink-50" />
        <p className="text-sm text-ink-300">{label}</p>
      </div>
    </div>
  );
}
