// A soft "tick" when the pointer moves across the left rail, like the macOS
// Dock. Synthesised with Web Audio (no sound file): a 40ms sine blip that
// falls in pitch, kept very quiet because it plays dozens of times a day.
// Browsers keep audio locked until the first click on the page, so hovers
// before that are silent. Muted via the speaker toggle in the top bar.

export const UI_SOUND_KEY = "sphaera-ui-sounds";

let ctx: AudioContext | null = null;
let lastTick = 0;

export function uiSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(UI_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setUiSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem(UI_SOUND_KEY, on ? "on" : "off");
  } catch {
    // storage unavailable (private mode): the choice lasts this page view
  }
}

export function playTick() {
  if (typeof window === "undefined" || !uiSoundsEnabled()) return;
  // Mouse only: touch "hovers" on tap and would tick on every press.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  // Sweeping quickly across the rail shouldn't become a buzz.
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;

  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    ctx ??= new AudioCtx();
    if (ctx.state !== "running") {
      void ctx.resume();
      return;
    }
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.035);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  } catch {
    // audio unavailable: hovering stays silent
  }
}
