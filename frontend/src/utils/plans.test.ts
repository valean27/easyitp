import { describe, expect, it } from 'vitest';
import { amountWithVat, includes, monthlyPrice } from './plans';

describe('plans', () => {
  it('a plan includes the ones below it', () => {
    expect(includes('PREMIUM', 'PRO')).toBe(true);
    expect(includes('PRO', 'PREMIUM')).toBe(false);
    expect(includes('FREE', 'FREE')).toBe(true);
  });

  it('adds the SMS pack only on paid plans', () => {
    expect(monthlyPrice('PRO', 300)).toBe(188);
    expect(monthlyPrice('FREE', 300)).toBe(0);
  });

  it('matches the server amounts (VAT, 12 months for 10)', () => {
    expect(amountWithVat('PRO', 300, 1)).toBe(227.48);
    expect(amountWithVat('PREMIUM', 600, 1)).toBe(384.78);
    expect(amountWithVat('PRO', 0, 12)).toBe(713.9);
  });
});
