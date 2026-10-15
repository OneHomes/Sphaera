// The triangular "APEX" mark used on the app's loading splash
// (app/(app)/loading.tsx) — pulled out so other in-app loading states
// (e.g. the leads table's pagination overlay) can reuse the same branding
// instead of a plain spinner.
export function ApexGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 90" fill="none" className={className}>
      <polygon points="50,4 12,86 42,86" fill="currentColor" />
      <polygon points="50,4 88,86 58,86" fill="currentColor" />
    </svg>
  );
}
