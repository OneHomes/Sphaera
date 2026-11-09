// The official Sphaera wordmark (brand handover, Downloads/Logo, Sphaera-01
// and -03). The PNGs in public/brand are transparent masks, painted with
// currentColor (app/globals.css `.brand-wordmark`), so one file works on the
// dark rails and the light theme alike. Size it with a height class; the
// width follows the logo's aspect ratio.
export function SphaeraWordmark({ tagline = false, className = "" }: { tagline?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={tagline ? "Sphaera, Intelligent Revenue Platform" : "Sphaera"}
      className={`${tagline ? "brand-wordmark-tagline" : "brand-wordmark"} inline-block shrink-0 bg-current ${className}`}
    />
  );
}
