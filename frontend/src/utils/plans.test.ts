import { describe, expect, it } from 'vitest';
import { amountWithVat, includes, monthlyPrice, paidUntil, vatIncluded } from './plans';

describe('plans', () => {
  it('a plan includes the ones below it', () => {
    expect(includes('PREMIUM', 'PRO')).toBe(true);
    expect(includes('PRO', 'PREMIUM')).toBe(false);
    expect(includes('FREE', 'FREE')).toBe(true);
  });

  it('adds the SMS pack only on paid plans', () => {
    expect(monthlyPrice('PRO', 300)).toBe(178);
    expect(monthlyPrice('FREE', 300)).toBe(0);
  });

  it('matches the server amounts (VAT included, 12 months for 10)', () => {
    expect(amountWithVat('PRO', 300, 1)).toBe(178);
    expect(amountWithVat('PREMIUM', 600, 1)).toBe(328);
    expect(amountWithVat('PRO', 0, 12)).toBe(590);
    expect(vatIncluded(121)).toBe(21);
    expect(vatIncluded(59)).toBe(10.24);
  });
});

describe('paidUntil', () => {
  const none = { paidPlan: 'FREE' as const, planUntil: null, trial: false, smsPlan: 0 };
  it('starts today when nothing is paid, after the last trial day on trial', () => {
    expect(paidUntil(none, 'PRO', 0, 1, '2026-10-07')).toBe('2026-11-07');
    expect(paidUntil({ paidPlan: 'PREMIUM', planUntil: '2026-10-20', trial: true, smsPlan: 0 }, 'PRO', 0, 12, '2026-10-07')).toBe('2027-10-20');
  });

  it('clamps to the end of the month like LocalDate.plusMonths', () => {
    expect(paidUntil(none, 'PRO', 0, 1, '2026-01-31')).toBe('2026-02-28');
  });

  it('extends the same plan after the last paid day', () => {
    expect(paidUntil({ paidPlan: 'PRO', planUntil: '2026-10-20', trial: false, smsPlan: 0 }, 'PRO', 0, 1, '2026-10-07')).toBe('2026-11-20');
  });

  it('converts the remaining days of another plan by price', () => {
    // 20 zile de Premium (99) = 33 de zile de Pro (59)
    expect(paidUntil({ paidPlan: 'PREMIUM', planUntil: '2026-10-27', trial: false, smsPlan: 0 }, 'PRO', 0, 1, '2026-10-07')).toBe('2026-12-10');
  });
});
