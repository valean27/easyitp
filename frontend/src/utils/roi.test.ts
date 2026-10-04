import { describe, expect, it } from 'vitest';
import { estimateRoi } from './roi';

describe('estimateRoi', () => {
  it('counts the yearly clients that come back thanks to reminders', () => {
    const r = estimateRoi({ itpPerMonth: 300, avgPrice: 150, lostPercent: 30, recoveredPercent: 20 });
    expect(r.clientsPerYear).toBe(3600);
    expect(r.lostPerYear).toBe(1080);
    expect(r.recoveredPerYear).toBe(216);
    expect(r.revenuePerYear).toBe(32400);
    expect(r.revenuePerMonth).toBe(2700);
  });

  it('ignores impossible values', () => {
    const r = estimateRoi({ itpPerMonth: -5, avgPrice: Number.NaN, lostPercent: 300, recoveredPercent: 50 });
    expect(r.revenuePerYear).toBe(0);
  });
});
