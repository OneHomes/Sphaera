// Single source of truth for the Janus mark, used wherever Janus is named
// (pipeline insight, lead summary, call workspace, dashboard slot). Paths
// are the official mark from the brand handover (Downloads/janus,
// Sphaera-07.svg) without its "JANUS" lettering; the viewBox is cropped
// square around the mark. Rendered with currentColor so it follows theme.
export function JanusGlyph({ className = "h-10 w-10 text-white" }: { className?: string }) {
  return (
    <svg viewBox="66 -18 376 376" fill="currentColor" className={className} aria-hidden="true">
      <path d="M389.3,81c-20.8-15.7-45.8-21.9-69.7-19.6L355,14.4h-40.2L181.9,190.4c-5.1,6.6-14,8.3-20.6,3.2s-7.1-13.7-2-20.3l120-158.9h-33.9L137.9,156.9c-14.5,19.2-10.8,46.8,8.6,61.3c19.2,14.5,46.8,10.8,61.3-8.6l72.3-95.7c23.5-25,62.3-28.7,90.3-7.6c29.9,22.6,35.8,65.2,13.3,95.1l-93.5,123.9h39.7L409,220.4C441.8,176.5,433.2,114.1,389.3,81z" />
      <path d="M353.6,123.8c-19.2-14.5-46.8-10.8-61.3,8.6l-72.3,95.7c-23.5,25-62.3,28.7-90.3,7.6c-29.9-22.6-35.8-65.2-13.3-95.1L212,14.3h-39.7l-81,107.5C58.2,165.7,66.8,228,110.7,261.1c20.8,15.7,45.8,21.9,69.7,19.6l-33.6,44.4H187l130.8-173.4c5.1-6.6,14-8.3,20.6-3.2c6.6,5.1,7.1,13.7,2,20.3l-118,156.3h33.9l105.7-140C376.8,165.9,373.1,138.5,353.6,123.8z" />
    </svg>
  );
}
