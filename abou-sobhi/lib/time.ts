/**
 * Everything time-related is anchored to Asia/Beirut, because the shop, its
 * staff and its customers all are — the server may be anywhere.
 */

export const SHOP_TZ = 'Asia/Beirut';

/**
 * A shawarma shop closes at 2am, so the sandwiches sold at 01:30 belong to the
 * night that started the evening before. Anything before this hour is counted
 * against the previous calendar day.
 */
export const BUSINESS_DAY_CUTOFF_HOUR = 4;

interface BeirutParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});

export function beirutParts(date: Date = new Date()): BeirutParts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  // Intl renders midnight as "24" in some ICU versions; normalise it to 0.
  const hour = Number(get('hour')) % 24;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    weekday: Math.max(0, WEEKDAYS.indexOf(get('weekday'))),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The Beirut calendar day an order's takings belong to (`YYYY-MM-DD`). */
export function businessDay(date: Date = new Date()): string {
  const p = beirutParts(date);
  if (p.hour < BUSINESS_DAY_CUTOFF_HOUR) {
    const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day));
    shifted.setUTCDate(shifted.getUTCDate() - 1);
    return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  }
  return isoDate(p.year, p.month, p.day);
}

/** Business days going back from today, oldest first. */
export function recentBusinessDays(count: number, from: Date = new Date()): string[] {
  const today = businessDay(from);
  const [y, m, d] = today.split('-').map(Number);
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(Date.UTC(y, m - 1, d));
    cursor.setUTCDate(cursor.getUTCDate() - i);
    days.push(isoDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
  }
  return days;
}

export function beirutClock(date: Date = new Date()): string {
  const p = beirutParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export interface DayHours {
  /** `HH:MM`, shop local. */
  open: string;
  /** `HH:MM`; may be earlier than `open`, meaning it closes after midnight. */
  close: string;
  closed: boolean;
}

export const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, () => ({
  open: '11:00',
  close: '02:00',
  closed: false,
}));

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Whether the shop is serving right now. Handles the after-midnight close by
 * also testing yesterday's window, so 01:00 still counts as open when the shop
 * shut at 02:00.
 */
export function isOpenAt(hours: DayHours[], date: Date = new Date()): boolean {
  if (hours.length !== 7) return false;
  const p = beirutParts(date);
  const nowMin = p.hour * 60 + p.minute;

  const windowFor = (weekday: number) => hours[((weekday % 7) + 7) % 7];

  const todayWindow = windowFor(p.weekday);
  if (todayWindow && !todayWindow.closed) {
    const open = toMinutes(todayWindow.open);
    const close = toMinutes(todayWindow.close);
    if (close > open ? nowMin >= open && nowMin < close : nowMin >= open) return true;
  }

  // Yesterday's shift may still be running if it closes after midnight.
  const yesterdayWindow = windowFor(p.weekday - 1);
  if (yesterdayWindow && !yesterdayWindow.closed) {
    const open = toMinutes(yesterdayWindow.open);
    const close = toMinutes(yesterdayWindow.close);
    if (close <= open && nowMin < close) return true;
  }

  return false;
}

export function parseHours(raw: string | null | undefined): DayHours[] {
  if (!raw) return DEFAULT_HOURS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 7) return DEFAULT_HOURS;
    return parsed.map((entry) => {
      const row = entry as Partial<DayHours>;
      return {
        open: typeof row.open === 'string' ? row.open : '11:00',
        close: typeof row.close === 'string' ? row.close : '02:00',
        closed: Boolean(row.closed),
      };
    });
  } catch {
    return DEFAULT_HOURS;
  }
}

/** Adds minutes to a moment and renders it as a Beirut wall clock time. */
export function etaClock(minutes: number, from: Date = new Date()): string {
  return beirutClock(new Date(from.getTime() + minutes * 60_000));
}

/**
 * `DD/MM HH:MM` in Beirut, built by hand rather than through `Intl`.
 *
 * `Intl` renders the Arabic locale with an Arabic comma between date and time,
 * and that character reorders the two halves under the bidi algorithm — even
 * inside an LTR isolate — so a receipt reads `0110:31 ،09/`. A fixed numeric
 * stamp is unambiguous, identical in both languages, and cannot be reordered.
 */
export function formatBeirutDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const p = beirutParts(date);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`;
}
