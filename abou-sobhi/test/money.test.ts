import { describe, expect, it } from 'vitest';
import { formatLbp, groupDigits, lbpToUsd, parseLbpInput } from '@/lib/money';

describe('groupDigits', () => {
  it('groups Lebanese-sized numbers in threes', () => {
    expect(groupDigits(600_000)).toBe('600,000');
    expect(groupDigits(1_900_000)).toBe('1,900,000');
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(999)).toBe('999');
  });
});

describe('formatLbp', () => {
  it('uses the Arabic lira mark in Arabic and LBP in English', () => {
    expect(formatLbp(750_000, 'ar')).toBe('750,000 ل.ل');
    expect(formatLbp(750_000, 'en')).toBe('750,000 LBP');
  });
});

describe('lbpToUsd', () => {
  it('converts at the shop rate to two decimals', () => {
    expect(lbpToUsd(600_000, 89_500)).toBeCloseTo(6.7, 2);
  });

  it('refuses to divide by an unusable rate', () => {
    expect(lbpToUsd(600_000, 0)).toBeNull();
    expect(lbpToUsd(600_000, -1)).toBeNull();
    expect(lbpToUsd(600_000, Number.NaN)).toBeNull();
  });
});

describe('parseLbpInput', () => {
  it('accepts the shapes an owner actually types', () => {
    expect(parseLbpInput('1,200,000')).toBe(1_200_000);
    expect(parseLbpInput(' 750000 ')).toBe(750_000);
    expect(parseLbpInput('1.2m')).toBe(1_200_000);
    expect(parseLbpInput('150k')).toBe(150_000);
  });

  it('reads Arabic-Indic digits', () => {
    expect(parseLbpInput('٦٠٠٠٠٠')).toBe(600_000);
  });

  it('rejects anything that is not a price', () => {
    expect(parseLbpInput('abc')).toBeNull();
    expect(parseLbpInput('')).toBeNull();
    expect(parseLbpInput('12-34')).toBeNull();
  });
});
