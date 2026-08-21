"use client";

export function QuoteScreen({
  eyebrow,
  headline,
  onContinue,
}: {
  eyebrow: string;
  headline: string;
  onContinue: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onContinue}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onContinue();
      }}
      className="flex h-full cursor-pointer flex-col items-center justify-center gap-4 bg-base-950 px-6 text-center"
    >
      <p className="max-w-lg text-sm text-ink-500">{eyebrow}</p>
      <h1 className="max-w-2xl font-display text-3xl font-semibold leading-snug text-ink-50 sm:text-4xl">
        {headline}
      </h1>
      <p className="mt-4 text-xs text-ink-500">Click anywhere to continue</p>
    </div>
  );
}
