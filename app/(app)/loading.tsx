export default function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center">
        <ApexGlyph className="h-16 w-16 text-white" />
        <h1 className="mt-3 text-2xl font-bold tracking-[0.15em] text-white">
          APEX
        </h1>
        <p className="mt-1 text-[10px] tracking-[0.35em] text-ink-500">
          SALES COMMAND CENTER
        </p>

        <div className="relative mt-10 h-px w-40 overflow-hidden bg-base-700">
          <span className="absolute top-0 h-px w-[35%] animate-loadingSweep bg-white" />
        </div>
      </div>

      <div className="absolute bottom-14 flex flex-col items-center gap-1.5">
        <p className="text-[10px] tracking-[0.3em] text-ink-500">
          THE INTELLIGENT SALES COMMAND SYSTEM
        </p>
        <p className="text-[9px] tracking-[0.3em] text-ink-500/50">
          SPHAERA TECHNOLOGIES&reg;
        </p>
      </div>
    </div>
  );
}

function ApexGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 90" fill="none" className={className}>
      <polygon points="50,4 12,86 42,86" fill="currentColor" />
      <polygon points="50,4 88,86 58,86" fill="currentColor" />
    </svg>
  );
}
