import { describe, expect, it } from 'vitest';
import { formatPhone, isValidLebanesePhone, normaliseLebanesePhone, toInternational } from '@/lib/phone';

describe('normaliseLebanesePhone', () => {
  it('accepts every way a Lebanese mobile is written', () => {
    const expected = '71123456';
    expect(normaliseLebanesePhone('71 123 456')).toBe(expected);
    expect(normaliseLebanesePhone('71123456')).toBe(expected);
    expect(normaliseLebanesePhone('+961 71 123 456')).toBe(expected);
    expect(normaliseLebanesePhone('0096171123456')).toBe(expected);
    expect(normaliseLebanesePhone('71/123456')).toBe(expected);
  });

  it('tolerates a trunk zero typed before a mobile that does not take one', () => {
    expect(normaliseLebanesePhone('071 123 456')).toBe('71123456');
  });

  it('keeps the leading zero on the legacy 03 block', () => {
    expect(normaliseLebanesePhone('03 123 456')).toBe('03123456');
    // Its international form drops that zero, so the reverse must restore it.
    expect(normaliseLebanesePhone('+961 3 123 456')).toBe('03123456');
  });

  it('accepts landlines', () => {
    expect(normaliseLebanesePhone('06 431 000')).toBe('06431000');
    expect(normaliseLebanesePhone('+961 6 431 000')).toBe('06431000');
  });

  it('rejects wrong lengths and unknown prefixes', () => {
    expect(normaliseLebanesePhone('71 123')).toBeNull();
    expect(normaliseLebanesePhone('99 123 456')).toBeNull();
    expect(normaliseLebanesePhone('71 123 456 789')).toBeNull();
    expect(normaliseLebanesePhone('')).toBeNull();
  });
});

describe('toInternational', () => {
  it('produces the form wa.me and tel: links need', () => {
    expect(toInternational('71 123 456')).toBe('96171123456');
    expect(toInternational('03 123 456')).toBe('9613123456');
    expect(toInternational('06 431 000')).toBe('9616431000');
    expect(toInternational('nonsense')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('spaces a number the way it is printed on a shopfront', () => {
    expect(formatPhone('76555111')).toBe('76 555 111');
  });

  it('leaves an unrecognised number untouched rather than mangling it', () => {
    expect(formatPhone('12345')).toBe('12345');
  });
});

describe('isValidLebanesePhone', () => {
  it('agrees with the normaliser', () => {
    expect(isValidLebanesePhone('76 555 111')).toBe(true);
    expect(isValidLebanesePhone('12345')).toBe(false);
  });
});
