import { describe, expect, it } from 'vitest';
import { appointmentInspector, chartBars, failRate, initials, perDay, periodRange, scheduleSummary } from './inspectors';
import type { Inspector } from '../types';

const team: Inspector[] = [
  { id: 1, name: 'Ana Pop', phone: null, color: 'blue', active: true, defaultLine: 1, attestationUntil: null, attestationDaysLeft: null, schedule: [], login: null },
  { id: 2, name: 'Ion', phone: null, color: 'orange', active: true, defaultLine: 2, attestationUntil: null, attestationDaysLeft: null, schedule: [], login: null },
];

describe('inspectors', () => {
  it('builds initials', () => {
    expect(initials('Ana Maria Pop')).toBe('AP');
    expect(initials(' ion ')).toBe('I');
    expect(initials('')).toBe('?');
  });

  it('picks the inspector chosen on the appointment, else the one on its line', () => {
    expect(appointmentInspector({ inspectorId: 2, lineInspectorId: 1 }, team)?.name).toBe('Ion');
    expect(appointmentInspector({ inspectorId: null, lineInspectorId: 1 }, team)?.name).toBe('Ana Pop');
    expect(appointmentInspector({}, team)).toBeUndefined();
  });

  it('computes rates', () => {
    expect(failRate({ itps: 8, failed: 2 })).toBe(25);
    expect(failRate({ itps: 0, failed: 0 })).toBe(0);
    expect(perDay({ itps: 10, daysWorked: 3 })).toBe(3.3);
  });

  it('computes period ranges', () => {
    expect(periodRange('week', '2026-10-08')).toEqual({ from: '2026-10-02', to: '2026-10-08' });
    expect(periodRange('month', '2026-10-08')).toEqual({ from: '2026-10-01', to: '2026-10-08' });
    expect(periodRange('lastMonth', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('year', '2026-10-08')).toEqual({ from: '2026-01-01', to: '2026-10-08' });
  });

  it('groups chart bars by day, folding extra series into "other"', () => {
    const days = [
      { date: '2026-10-01', total: 3, byInspector: [{ key: 'id:1', count: 2 }, { key: 'none', count: 1 }] },
      { date: '2026-10-02', total: 0, byInspector: [] },
    ];
    const bars = chartBars(days, ['id:1']);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ label: '1', total: 3, segments: [{ key: 'id:1', count: 2 }, { key: 'other', count: 1 }] });
    expect(bars[1].total).toBe(0);
  });

  it('groups by month for long periods', () => {
    const days = Array.from({ length: 70 }, (_, i) => {
      const d = new Date(2026, 0, 1 + i).toLocaleDateString('sv-SE');
      return { date: d, total: 1, byInspector: [{ key: 'id:1', count: 1 }] };
    });
    const bars = chartBars(days, ['id:1']);
    expect(bars.map((b) => b.label)).toEqual(['ian', 'feb', 'mar']);
    expect(bars[0].total).toBe(31);
  });
});

describe('scheduleSummary', () => {
  const day = (weekday: number, start: string | null = '08:00:00', end: string | null = '16:00:00') => ({ weekday, line: null, start, end });
  it('summarizes the week', () => {
    expect(scheduleSummary([])).toBe('Fără program fix');
    expect(scheduleSummary([1, 2, 3, 4, 5].map((d) => day(d)))).toBe('Lu–Vi 08:00–16:00');
    expect(scheduleSummary([day(1), day(3), day(5)])).toBe('Lu, Mi, Vi 08:00–16:00');
    expect(scheduleSummary([day(1, null, null), day(2, null, null)])).toBe('Lu, Ma');
    expect(scheduleSummary([day(1), day(2, '12:00', '20:00'), day(3)])).toBe('Lu–Mi · ore diferite');
  });
});
