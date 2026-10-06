import { describe, expect, it } from 'vitest';
import { GUIDE, matches } from './guide';

describe('guide', () => {
  const all = GUIDE.flatMap((g) => g.sections);

  it('has unique section ids', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });

  it('search ignores diacritics and case', () => {
    const sms = all.find((s) => s.id === 'sms-automate')!;
    expect(matches(sms, 'TELEFONUL ANDROID AL STATIEI')).toBe(true);
    expect(matches(sms, 'rovinieta')).toBe(true);
    expect(matches(sms, 'oblio')).toBe(false);
    expect(matches(sms, '  ')).toBe(true);
  });
});
