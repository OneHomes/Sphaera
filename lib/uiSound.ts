// A soft "tick" when the pointer moves across the left rail, like the macOS
// Dock. Synthesised with Web Audio (no sound file): a 40ms sine blip that
// falls in pitch, kept short because it plays dozens of times a day.
// Muted via the speaker toggle in the top bar.
//
// Browsers only let audio start inside a user gesture (click, key press).
// A hover is not a gesture, so creating or resuming the AudioContext from
// the hover itself leaves it suspended and every tick is silent. Instead
// the context is created/resumed on the page's first pointerdown/keydown,
// and hovers after that play.

export const UI_SOUND_KEY = "sphaera-ui-sounds";

// Peak loudness of the tick (0–1). Raised from 0.035 on request: it was too
// faint to hear over normal laptop volume.
const TICK_VOLUME = 0.12;

let ctx: AudioContext | null = null;
let lastTick = 0;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  return ctx;
}

// Runs inside the gesture, which is what allows the context to start.
function unlockAudio() {
  try {
    const c = getContext();
    if (c && c.state !== "running") void c.resume();
  } catch {
    // audio unavailable: hovering stays silent
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
  window.addEventListener("keydown", unlockAudio, { capture: true, passive: true });
}

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
    // Not unlocked by a click/key press yet: nothing can play.
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.035);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(TICK_VOLUME, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  } catch {
    // audio unavailable: hovering stays silent
  }
}
