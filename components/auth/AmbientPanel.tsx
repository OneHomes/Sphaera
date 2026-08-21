export function AmbientPanel() {
  // Concentric dot rings around the Sphaera mark, matching the reference
  // sign-in screen's right-hand ambient visual.
  const rings = [6, 5.2, 4.4, 3.6, 2.8, 2];

  return (
    <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-black md:flex">
      <svg
        viewBox="0 0 400 400"
        className="absolute h-[140%] w-[140%] opacity-70"
        aria-hidden
      >
        {rings.map((radiusRem, ringIndex) => {
          const radius = 40 + ringIndex * 28;
          const dotCount = 24 + ringIndex * 10;
          return Array.from({ length: dotCount }).map((_, i) => {
            const angle = (i / dotCount) * Math.PI * 2;
            const x = 200 + radius * Math.cos(angle);
            const y = 200 + radius * Math.sin(angle);
            return (
              <circle
                key={`${ringIndex}-${i}`}
                cx={x}
                cy={y}
                r={1.4}
                fill="white"
                opacity={0.15 + (ringIndex / rings.length) * 0.5}
              />
            );
          });
        })}
      </svg>

      <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full">
        <SphaeraMarkLarge />
      </div>
    </div>
  );
}

function SphaeraMarkLarge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16 text-white">
      <circle cx="12" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.5 17.5c0-2.8 2.2-5.5 3.8-5.5M19.5 17.5c0-2.8-2.2-5.5-3.8-5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
