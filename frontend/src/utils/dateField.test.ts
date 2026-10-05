import { describe, expect, it } from 'vitest';
import { formatRo, inRange, maskRo, monthGrid, parseRo } from './dateField';

describe('dateField', () => {
  it('parses Romanian dates and rejects impossible ones', () => {
    expect(parseRo('12.03.2027')).toBe('2027-03-12');
    expect(parseRo('1/3/2027')).toBe('2027-03-01');
    expect(parseRo('12-03-27')).toBe('2027-03-12');
    expect(parseRo('31.02.2027')).toBeNull();
    expect(parseRo('12.03')).toBeNull();
    expect(parseRo('')).toBeNull();
  });

  it('formats and masks', () => {
    expect(formatRo('2027-03-12')).toBe('12.03.2027');
    expect(formatRo('')).toBe('');
    expect(maskRo('1203')).toBe('12.03');
    expect(maskRo('12032027')).toBe('12.03.2027');
    expect(maskRo('120320271')).toBe('12.03.2027');
    expect(maskRo('1/3/2027')).toBe('1/3/2027');
  });

  it('builds a Monday-first month grid', () => {
    // 1 octombrie 2026 e joi: grila incepe luni 28 septembrie
    const grid = monthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: '2026-09-28', day: 28, inMonth: false });
    expect(grid[3]).toEqual({ iso: '2026-10-01', day: 1, inMonth: true });
  });

  it('checks the allowed range', () => {
    expect(inRange('2026-10-06', '2026-10-01', '2026-10-31')).toBe(true);
    expect(inRange('2026-11-01', undefined, '2026-10-31')).toBe(false);
    expect(inRange('2026-01-01')).toBe(true);
  });
});
