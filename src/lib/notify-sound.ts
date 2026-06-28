// WebAudio notifications with multiple selectable sound presets.
// Used by both Admin and Kitchen dashboards.

export type NotifyKind = "new" | "cancelled" | "priority";
export type NotifyMode = "once" | "continuous" | "mute";

export type SoundId =
  | "classic-bell"
  | "restaurant-bell"
  | "telephone-ring"
  | "digital-chime"
  | "cash-register"
  | "soft-notification"
  | "double-bell"
  | "service-bell"
  | "kitchen-pager"
  | "modern-alert";

export const SOUND_PRESETS: { id: SoundId; label: string; description: string }[] = [
  { id: "classic-bell",      label: "Classic Bell",       description: "Warm hand-bell ring" },
  { id: "restaurant-bell",   label: "Restaurant Bell",    description: "Hostess counter bell" },
  { id: "telephone-ring",    label: "Telephone Ring",     description: "Two-tone phone ringback" },
  { id: "digital-chime",     label: "Digital Chime",      description: "Soft two-note chime" },
  { id: "cash-register",     label: "Cash Register Bell", description: "Ka-ching" },
  { id: "soft-notification", label: "Soft Notification",  description: "Gentle pop" },
  { id: "double-bell",       label: "Double Bell",        description: "Bicycle-style double ring" },
  { id: "service-bell",      label: "Service Bell",       description: "Front-desk tap bell" },
  { id: "kitchen-pager",     label: "Kitchen Pager",      description: "Buzzing pager beep" },
  { id: "modern-alert",      label: "Modern Alert",       description: "Crisp UI alert" },
];

const LS_KEY = "bs.notify.v3";

export type NotifySettings = {
  enabled: boolean;
  volume: number; // 0..1
  mode: NotifyMode;
  sound: SoundId;
};

const DEFAULTS: NotifySettings = {
  enabled: true,
  volume: 0.7,
  mode: "continuous",
  sound: "telephone-ring",
};

export function loadNotifySettings(): NotifySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) {
      // migrate from v2 if present
      const v2 = window.localStorage.getItem("bs.notify.v2");
      if (v2) {
        try {
          const p = JSON.parse(v2) as Partial<NotifySettings>;
          return { ...DEFAULTS, ...p };
        } catch { /* ignore */ }
      }
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<NotifySettings>;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      volume: Math.min(1, Math.max(0, parsed.volume ?? DEFAULTS.volume)),
      mode: (["once", "continuous", "mute"] as NotifyMode[]).includes(parsed.mode as NotifyMode)
        ? (parsed.mode as NotifyMode)
        : DEFAULTS.mode,
      sound: SOUND_PRESETS.some((s) => s.id === parsed.sound) ? (parsed.sound as SoundId) : DEFAULTS.sound,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveNotifySettings(s: NotifySettings) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
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

type Wave = OscillatorType;
function tone(freq: number, startOffset: number, duration: number, volume: number, type: Wave = "sine") {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + startOffset;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.start(t);
  o.stop(t + duration + 0.02);
}

function noiseBurst(startOffset: number, duration: number, volume: number) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + startOffset;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain();
  src.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.start(t);
  src.stop(t + duration);
}

// One full "ring burst" per sound preset (~0.5–2 s).
function playSoundBurst(sound: SoundId, volume: number) {
  const v = Math.max(0, Math.min(1, volume));
  switch (sound) {
    case "classic-bell": {
      const vv = v * 0.5;
      tone(880, 0.00, 0.9, vv, "sine");
      tone(1320, 0.00, 0.7, vv * 0.7, "sine");
      tone(1760, 0.00, 0.5, vv * 0.4, "sine");
      break;
    }
    case "restaurant-bell": {
      const vv = v * 0.55;
      tone(1568, 0.00, 0.6, vv, "triangle");
      tone(2093, 0.00, 0.5, vv * 0.6, "triangle");
      tone(1568, 0.65, 0.5, vv * 0.7, "triangle");
      break;
    }
    case "telephone-ring": {
      const vv = v * 0.55;
      for (const start of [0.0, 0.22, 0.44, 0.95, 1.17, 1.39]) {
        tone(440, start, 0.18, vv, "sine");
        tone(480, start, 0.18, vv, "sine");
      }
      break;
    }
    case "digital-chime": {
      const vv = v * 0.5;
      tone(1318, 0.0, 0.25, vv, "sine");
      tone(1760, 0.22, 0.35, vv, "sine");
      break;
    }
    case "cash-register": {
      const vv = v * 0.5;
      tone(2349, 0.00, 0.12, vv, "square");
      tone(1760, 0.10, 0.12, vv, "square");
      noiseBurst(0.22, 0.18, v * 0.3);
      tone(987,  0.30, 0.35, vv * 0.7, "triangle");
      break;
    }
    case "soft-notification": {
      const vv = v * 0.45;
      tone(880, 0.0, 0.18, vv, "sine");
      tone(1175, 0.12, 0.28, vv, "sine");
      break;
    }
    case "double-bell": {
      const vv = v * 0.55;
      tone(1760, 0.00, 0.18, vv, "triangle");
      tone(1760, 0.22, 0.18, vv, "triangle");
      break;
    }
    case "service-bell": {
      const vv = v * 0.6;
      tone(2637, 0.00, 0.5, vv, "sine");
      tone(3520, 0.00, 0.4, vv * 0.6, "sine");
      break;
    }
    case "kitchen-pager": {
      const vv = v * 0.5;
      for (const s of [0.0, 0.2, 0.4]) tone(2200, s, 0.12, vv, "square");
      break;
    }
    case "modern-alert": {
      const vv = v * 0.5;
      tone(660, 0.0, 0.1, vv, "sawtooth");
      tone(990, 0.12, 0.18, vv, "sawtooth");
      tone(1320, 0.30, 0.22, vv, "sawtooth");
      break;
    }
  }
}

/** Play the configured sound once. */
export function playNotify(kind: NotifyKind = "new", override?: Partial<NotifySettings>) {
  const s = { ...loadNotifySettings(), ...override };
  if (!s.enabled || s.volume <= 0 || s.mode === "mute") return;
  if (kind === "cancelled") {
    const v = s.volume * 0.4;
    tone(520, 0, 0.22, v);
    tone(392, 0.18, 0.32, v);
    return;
  }
  playSoundBurst(s.sound, s.volume);
}

/** Preview a specific sound (used by the picker). */
export function previewSound(id: SoundId, volume = 0.7) {
  playSoundBurst(id, volume);
}

// ----- Continuous ringer ---------------------------------------------------

let ringTimer: number | null = null;
let ringing = false;

export function isRinging() { return ringing; }

/** Begin ringing every ~4 s until stopRinging() is called. Safe to call repeatedly. */
export function startRinging(override?: Partial<NotifySettings>) {
  const s = { ...loadNotifySettings(), ...override };
  if (!s.enabled || s.volume <= 0 || s.mode === "mute") return;
  if (ringing) return;
  ringing = true;
  const fire = () => {
    const cur = { ...loadNotifySettings(), ...override };
    if (!cur.enabled || cur.volume <= 0 || cur.mode === "mute") return;
    playSoundBurst(cur.sound, cur.volume);
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
