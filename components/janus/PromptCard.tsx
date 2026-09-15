"use client";

import type { LucideIcon } from "lucide-react";

type PromptCardProps = {
  icon: LucideIcon;
  iconColorClass: string;
  label: string;
  onSelect: (label: string) => void;
};

export function PromptCard({
  icon: Icon,
  iconColorClass,
  label,
  onSelect,
}: PromptCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      className="flex w-32 flex-col items-start gap-2 rounded-xl border border-base-700 bg-base-900 p-3 text-left text-xs text-ink-300 transition hover:border-base-600 hover:bg-base-800 hover:text-ink-50"
    >
      <Icon className={`h-3.5 w-3.5 ${iconColorClass}`} strokeWidth={2} />
      <span className="leading-snug">{label}</span>
    </button>
  );
}
