import { describe, expect, it } from 'vitest';
import { badge, timeAgo } from './notifications';

describe('notifications', () => {
  const now = new Date(2026, 9, 12, 15, 0);
  it('says how long ago', () => {
    expect(timeAgo(new Date(2026, 9, 12, 14, 59, 40).toISOString(), now)).toBe('acum');
    expect(timeAgo(new Date(2026, 9, 12, 14, 55).toISOString(), now)).toBe('acum 5 min');
    expect(timeAgo(new Date(2026, 9, 12, 12, 0).toISOString(), now)).toBe('acum 3 h');
    expect(timeAgo(new Date(2026, 9, 11, 20, 0).toISOString(), now)).toBe('ieri');
    expect(timeAgo(new Date(2026, 9, 3, 9, 0).toISOString(), now)).toBe('03.10');
  });

  it('caps the badge', () => {
    expect(badge(0)).toBeNull();
    expect(badge(7)).toBe('7');
    expect(badge(150)).toBe('99+');
  });
});
