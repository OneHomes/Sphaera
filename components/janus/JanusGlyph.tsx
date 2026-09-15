// Single source of truth for the Janus mark — previously each surface
// (Command Center, the dashboard slot, the lead summary card, pipeline
// insight) defined its own slightly-different inline glyph. Consolidated
// here both for consistency and to get closer to the design's spiral
// mark (three petals radiating from center) instead of the placeholder
// three-wave-lines shape used before.
export function JanusGlyph({ className = "h-10 w-10 text-white" }: { className?: string }) {
  const petal = "M24,24 C14,22 8,13 13,4 C20,9 24,16 24,24 Z";
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className}>
      <g transform="rotate(0 24 24)">
        <path d={petal} />
      </g>
      <g transform="rotate(120 24 24)">
        <path d={petal} />
      </g>
      <g transform="rotate(240 24 24)">
        <path d={petal} />
      </g>
    </svg>
  );
}
