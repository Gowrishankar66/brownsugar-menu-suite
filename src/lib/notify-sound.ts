// Lightweight WebAudio-based notification tones with persisted settings.
// Used by both Admin and Kitchen dashboards.

export type NotifyKind = "new" | "cancelled" | "priority";

const LS_KEY = "bs.notify.v1";

export type NotifySettings = {
  enabled: boolean;
  volume: number; // 0..1
};

const DEFAULTS: NotifySettings = { enabled: true, volume: 0.6 };

export function loadNotifySettings(): NotifySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotifySettings>;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      volume: Math.min(1, Math.max(0, parsed.volume ?? DEFAULTS.volume)),
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

/** Pleasant two-tone restaurant chime — varies by event kind. */
export function playNotify(kind: NotifyKind = "new", override?: Partial<NotifySettings>) {
  const s = { ...loadNotifySettings(), ...override };
  if (!s.enabled || s.volume <= 0) return;
  const v = s.volume * 0.4;
  if (kind === "new") {
    tone(880, 0, 0.22, v);
    tone(1175, 0.18, 0.32, v);
  } else if (kind === "cancelled") {
    tone(520, 0, 0.22, v);
    tone(392, 0.18, 0.32, v);
  } else {
    tone(988, 0, 0.18, v);
    tone(988, 0.22, 0.18, v);
    tone(1318, 0.44, 0.36, v);
  }
}
