"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playTick, setUiSoundsEnabled, uiSoundsEnabled } from "@/lib/uiSound";

// Turns the left rail's hover tick (lib/uiSound.ts) on or off; the choice is
// remembered per browser.
export function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(uiSoundsEnabled());
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setUiSoundsEnabled(next);
    // A sample so you hear what you turned on; a beat later because this
    // click is also what unlocks audio, and that takes a moment.
    if (next) setTimeout(playTick, 80);
  }

  const label = on ? "Turn off menu sounds" : "Turn on menu sounds";
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-base-800 hover:text-ink-50"
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
    </button>
  );
}
