import { describe, expect, it } from 'vitest';
import { daysText, dueFirst } from './stationDeadlines';
import type { StationDeadline } from '../types';

const d = (id: number, daysLeft: number, due: boolean): StationDeadline => ({
  id,
  kind: 'METROLOGIE',
  label: 'Verificare metrologică',
  title: null,
  dueDate: '2026-10-10',
  daysLeft,
  notes: null,
  due,
});

describe('stationDeadlines', () => {
  it('describes the days left', () => {
    expect(daysText(-1)).toBe('expirat de 1 zi');
    expect(daysText(-5)).toBe('expirat de 5 zile');
    expect(daysText(0)).toBe('expiră azi');
    expect(daysText(12)).toBe('expiră în 12 zile');
  });

  it('keeps only the due ones, most urgent first', () => {
    expect(dueFirst([d(1, 20, true), d(2, 90, false), d(3, -3, true)]).map((x) => x.id)).toEqual([3, 1]);
  });
});
