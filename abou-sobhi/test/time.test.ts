import { describe, expect, it } from 'vitest';
import {
  businessDay,
  formatBeirutDateTime,
  isOpenAt,
  recentBusinessDays,
  DEFAULT_HOURS,
} from '@/lib/time';

/** Beirut is UTC+3 in summer and UTC+2 in winter; these are all summer dates. */
const beirut = (iso: string) => new Date(iso);

describe('businessDay', () => {
  it('uses the Beirut calendar day during normal hours', () => {
    expect(businessDay(beirut('2026-06-15T18:00:00Z'))).toBe('2026-06-15');
  });

  it('counts a 1am sandwich against the night that started the evening before', () => {
    // 01:30 Beirut on the 16th is 22:30 UTC on the 15th.
    expect(businessDay(beirut('2026-06-15T22:30:00Z'))).toBe('2026-06-15');
  });

  it('starts a new business day after the 4am cutoff', () => {
    // 05:00 Beirut on the 16th is 02:00 UTC.
    expect(businessDay(beirut('2026-06-16T02:00:00Z'))).toBe('2026-06-16');
  });
});

describe('recentBusinessDays', () => {
  it('returns a contiguous window, oldest first, ending today', () => {
    const days = recentBusinessDays(7, beirut('2026-06-15T18:00:00Z'));
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-06-15');
    expect(days[0]).toBe('2026-06-09');
  });

  it('walks backwards across a month boundary', () => {
    const days = recentBusinessDays(3, beirut('2026-07-01T18:00:00Z'));
    expect(days).toEqual(['2026-06-29', '2026-06-30', '2026-07-01']);
  });
});

describe('isOpenAt', () => {
  it('is open inside the evening window', () => {
    // 20:00 Beirut, shop runs 11:00–02:00.
    expect(isOpenAt(DEFAULT_HOURS, beirut('2026-06-15T17:00:00Z'))).toBe(true);
  });

  it('is still open at 01:00, because yesterday closes at 02:00', () => {
    expect(isOpenAt(DEFAULT_HOURS, beirut('2026-06-15T22:00:00Z'))).toBe(true);
  });

  it('is shut at 09:00, between the close and the next open', () => {
    expect(isOpenAt(DEFAULT_HOURS, beirut('2026-06-15T06:00:00Z'))).toBe(false);
  });

  it('respects a day marked closed', () => {
    const hours = DEFAULT_HOURS.map((day, index) => (index === 1 ? { ...day, closed: true } : day));
    // 2026-06-15 is a Monday; 20:00 Beirut.
    expect(isOpenAt(hours, beirut('2026-06-15T17:00:00Z'))).toBe(false);
  });
});

describe('formatBeirutDateTime', () => {
  it('stamps the Beirut wall clock, not the server clock', () => {
    // 18:00 UTC on 15 June is 21:00 in Beirut (UTC+3 in summer).
    expect(formatBeirutDateTime('2026-06-15T18:00:00Z')).toBe('15/06 21:00');
  });

  it('renders the same in both languages, with nothing bidi can reorder', () => {
    const stamp = formatBeirutDateTime('2026-06-15T18:00:00Z');
    // Only digits, a slash and a colon — no locale-specific separator.
    expect(stamp).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it('does not crash on a broken timestamp', () => {
    expect(formatBeirutDateTime('not-a-date')).toBe('—');
  });
});
