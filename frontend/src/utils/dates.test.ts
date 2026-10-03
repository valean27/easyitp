import { describe, expect, it } from 'vitest';
import { formatTime, toLocalIso } from './dates';

describe('dates', () => {
  it('formats local time without converting to UTC', () => {
    expect(toLocalIso(new Date(2026, 9, 3, 23, 30, 5))).toBe('2026-10-03T23:30:05');
  });

  it('extracts HH:mm', () => {
    expect(formatTime('2026-10-03T09:05:00')).toBe('09:05');
  });
});
