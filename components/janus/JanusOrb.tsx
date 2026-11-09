"use client";

import { useEffect, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

// The animated "Janus is working" indicator (thinking-orbs, a canvas
// component). It replaces the generic spinner wherever Janus itself is
// busy, so AI work reads differently from ordinary loading. Each surface
// picks the state that matches what Janus is doing:
//   working   — answering a question (Command Center, coaching)
//   solving   — analysing numbers (pipeline insight, finance questions)
//   composing — writing something (drafts, proposals, notes, briefs)
//   searching — looking through records (history, documents)
//   listening — during a live call, or while dictating to Janus
//   breathing — idle, waiting to be asked (the Janus pill)
// The package already pauses offscreen and respects prefers-reduced-motion.
export type JanusOrbState = "working" | "solving" | "composing" | "searching" | "listening" | "breathing";

// The package's "auto" theme looks for a `dark`/`light` class and otherwise
// falls back to the OS setting, but Sphaera's dark mode is the class-less
// default (only `html.light` is set) and the sidebars pin themselves dark
// with `.theme-dark`. Resolve it the way globals.css does instead.
function resolveTheme(el: HTMLElement | null): "dark" | "light" {
  if (el?.closest(".theme-dark")) return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function JanusOrb({
  state = "working",
  size = 20,
  className,
}: {
  state?: JanusOrbState;
  size?: 20 | 64;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const update = () => setTheme(resolveTheme(ref.current));
    update();
    // ThemeToggle flips the class on <html> without a reload.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={["inline-flex shrink-0", className].filter(Boolean).join(" ")}>
      <ThinkingOrb state={state} size={size} theme={theme} />
    </span>
  );
}
