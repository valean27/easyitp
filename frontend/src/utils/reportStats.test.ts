import { describe, expect, it } from 'vitest';
import { inspectorTotals, monthsWithData } from './reportStats';
import type { InspectorMonth } from '../types';

const row = (inspector: string, month: number, count: number, failed = 0): InspectorMonth => ({
  inspector,
  month,
  count,
  failed,
  recheck: 0,
  revenue: count * 100,
});

const rows = [row('Ana', 9, 3, 1), row('Ion', 9, 5), row('Nespecificat', 9, 9), row('Ana', 10, 4, 2)];

describe('inspectorTotals', () => {
  it('ranks inspectors for one month, unknown last', () => {
    expect(inspectorTotals(rows, 9).map((t) => [t.inspector, t.count])).toEqual([
      ['Ion', 5],
      ['Ana', 3],
      ['Nespecificat', 9],
    ]);
  });

  it('sums the whole year', () => {
    const ana = inspectorTotals(rows, null).find((t) => t.inspector === 'Ana')!;
    expect(ana).toEqual({ inspector: 'Ana', count: 7, failed: 3, recheck: 0, revenue: 700 });
    expect(inspectorTotals(rows, null)[0].inspector).toBe('Ana');
  });

  it('lists months that have data', () => {
    expect(monthsWithData(rows)).toEqual([9, 10]);
    expect(inspectorTotals(rows, 3)).toEqual([]);
  });
});
