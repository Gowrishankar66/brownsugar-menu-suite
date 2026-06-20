// WebAudio-based notifications with persistent settings. Supports a
// continuous "telephone ring" mode for unaccepted orders.

export type NotifyKind = "new" | "cancelled" | "priority";
export type NotifyMode = "once" | "continuous";

const LS_KEY = "bs.notify.v2";

export type NotifySettings = {
  enabled: boolean;
  volume: number; // 0..1
  mode: NotifyMode;
};

const DEFAULTS: NotifySettings = { enabled: true, volume: 0.7, mode: "continuous" };

export function loadNotifySettings(): NotifySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotifySettings>;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      volume: Math.min(1, Math.max(0, parsed.volume ?? DEFAULTS.volume)),
      mode: parsed.mode === "once" ? "once" : "continuous",
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveNotifySettings(s: NotifySettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, startOffset: number, duration: number, volume: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + startOffset;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.start(t);
  o.stop(t + duration + 0.02);
}

/** One full telephone-style ring burst (~2 s of ringing). */
function ringBurst(volume: number) {
  // Classic North-American ringback uses 440 Hz + 480 Hz mixed; we alternate
  // pulses to give an audible "brrring brrring" cadence.
  const v = volume * 0.55;
  // First "brrring"
  tone(440, 0.00, 0.18, v); tone(480, 0.00, 0.18, v);
  tone(440, 0.22, 0.18, v); tone(480, 0.22, 0.18, v);
  tone(440, 0.44, 0.18, v); tone(480, 0.44, 0.18, v);
  // Short gap
  // Second "brrring"
  tone(440, 0.95, 0.18, v); tone(480, 0.95, 0.18, v);
  tone(440, 1.17, 0.18, v); tone(480, 1.17, 0.18, v);
  tone(440, 1.39, 0.18, v); tone(480, 1.39, 0.18, v);
}

/** Single chime — used for status changes / cancellations, not new orders. */
export function playNotify(kind: NotifyKind = "new", override?: Partial<NotifySettings>) {
  const s = { ...loadNotifySettings(), ...override };
  if (!s.enabled || s.volume <= 0) return;
  const v = s.volume * 0.4;
  if (kind === "new") {
    ringBurst(s.volume);
  } else if (kind === "cancelled") {
    tone(520, 0, 0.22, v);
    tone(392, 0.18, 0.32, v);
  } else {
    tone(988, 0, 0.18, v);
    tone(988, 0.22, 0.18, v);
    tone(1318, 0.44, 0.36, v);
  }
}

// ----- Continuous ringer ---------------------------------------------------

let ringTimer: number | null = null;
let ringing = false;

export function isRinging() {
  return ringing;
}

/** Begin ringing every ~4 s until stopRinging() is called. Safe to call repeatedly. */
export function startRinging(override?: Partial<NotifySettings>) {
  const s = { ...loadNotifySettings(), ...override };
  if (!s.enabled || s.volume <= 0) return;
  if (ringing) return;
  ringing = true;
  const fire = () => {
    const cur = { ...loadNotifySettings(), ...override };
    if (!cur.enabled || cur.volume <= 0) return;
    ringBurst(cur.volume);
  };
  fire();
  ringTimer = window.setInterval(fire, 4000);
}

export function stopRinging() {
  ringing = false;
  if (ringTimer != null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
}
