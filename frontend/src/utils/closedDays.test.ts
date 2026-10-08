import { describe, expect, it } from 'vitest';
import { breakText, closedMap, closedNotice, closedRanges, rangeText, shortDate } from './closedDays';

describe('closedDays', () => {
  it('formats short dates and the public notice', () => {
    expect(shortDate('2026-12-01')).toBe('1 dec.');
    expect(closedNotice([])).toBeNull();
    expect(
      closedNotice([
        { date: '2026-11-30', name: 'Sfântul Andrei', holiday: true },
        { date: '2026-12-01', name: 'Ziua Națională', holiday: true },
        { date: '2026-12-02', name: null, holiday: false },
        { date: '2026-12-25', name: 'Crăciunul', holiday: true },
        { date: '2026-12-26', name: 'Crăciunul', holiday: true },
      ]),
    ).toBe('Închis: 30 noi. (Sfântul Andrei), 1 dec. (Ziua Națională), 2 dec. și încă 1.');
    expect(
      closedNotice([
        { date: '2026-10-12', name: 'Inventar', holiday: false },
        { date: '2026-10-13', name: 'Inventar', holiday: false },
      ]),
    ).toBe('Închis: 12 oct. – 13 oct. (Inventar).');
  });

  it('groups consecutive days with the same note', () => {
    const ranges = closedRanges([
      { date: '2026-11-04', name: 'Inventar', holiday: false },
      { date: '2026-11-02', name: 'Inventar', holiday: false },
      { date: '2026-11-03', name: 'Inventar', holiday: false },
      { date: '2026-11-05', name: null, holiday: false },
      { date: '2026-11-30', name: null, holiday: false },
      { date: '2026-12-01', name: null, holiday: false },
    ]);
    expect(ranges).toEqual([
      { from: '2026-11-02', to: '2026-11-04', name: 'Inventar' },
      { from: '2026-11-05', to: '2026-11-05', name: null },
      { from: '2026-11-30', to: '2026-12-01', name: null },
    ]);
    expect(rangeText(ranges[0])).toBe('2 noi. – 4 noi.');
    expect(rangeText(ranges[1])).toBe('5 noi.');
  });

  it('maps dates and formats the break', () => {
    expect(closedMap([{ date: '2026-12-01', name: 'Ziua Națională', holiday: true }]).get('2026-12-01')?.name).toBe('Ziua Națională');
    expect(closedMap(undefined).size).toBe(0);
    expect(breakText('12:00:00', '12:30:00')).toBe('12:00–12:30');
    expect(breakText(null, '12:30')).toBeNull();
  });
});
