"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// Light/dark switch; THEME_INIT_SCRIPT (app/layout.tsx) applies the saved choice before first paint.

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "light" : "dark");
    } catch {
      // storage unavailable (private mode); the toggle still works for this page view
    }
  }

  const label = light ? "Switch to dark mode" : "Switch to light mode";
  const Icon = light ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-base-800 hover:text-ink-50"
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
    </button>
  );
}
