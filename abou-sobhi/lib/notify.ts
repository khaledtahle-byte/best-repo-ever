/**
 * A new order at the counter has to be *heard*, not seen — the phone is in an
 * apron pocket. The chime is synthesised with the Web Audio API rather than
 * shipped as an mp3: no asset to lose, no autoplay-blocked <audio> element,
 * and it can be unlocked by the same tap that turns the sound on.
 */

let context: AudioContext | null = null;

type AudioContextConstructor = new () => AudioContext;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Call from a user gesture so later programmatic chimes are allowed to play. */
export async function unlockAudio(): Promise<void> {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') await ctx.resume();
}

/** Two rising notes — distinct from every notification tone a phone already makes. */
export function playNewOrderChime(): void {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.16 },
  ].forEach(({ freq, at }) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now + at);
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.32, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.34);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + at);
    oscillator.stop(now + at + 0.36);
  });
}

export async function requestDesktopNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function showDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon.svg', tag: 'abou-sobhi-order' });
  } catch {
    // Some browsers only allow notifications from a service worker; ignore.
  }
}
