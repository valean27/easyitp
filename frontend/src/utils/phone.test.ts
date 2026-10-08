import { describe, expect, it } from 'vitest';
import { checkMobile } from './phone';

describe('checkMobile', () => {
  it('accepts Romanian mobiles in any spelling', () => {
    expect(checkMobile('0722123456')).toMatchObject({ ok: true, formatted: '0722 123 456', country: null });
    expect(checkMobile('+40 722 123 456').formatted).toBe('0722 123 456');
    expect(checkMobile('0040722123456').ok).toBe(true);
  });

  it('accepts foreign mobiles with the country prefix', () => {
    const de = checkMobile('0049 1512 3456789');
    expect(de.ok).toBe(true);
    expect(de.formatted).toBe('+49 1512 3456789');
    expect(de.country).toBe('Germania');
    expect(checkMobile('+373 69 123 456').ok).toBe(true);
  });

  it('rejects typos, unknown prefixes and landlines', () => {
    for (const bad of ['072212345', '07221234567', '0122123456', 'abc', '+49 12']) {
      expect(checkMobile(bad).ok, bad).toBe(false);
    }
    expect(checkMobile('0264 123 456').error).toContain('mobil');
    expect(checkMobile('').error).toContain('Introduceți');
  });
});
