import { describe, expect, it } from 'vitest';
import { expiryState, monthLabel, parsePlates, recentMonths, statementCsv, statementHtml } from './fleet';
import type { FleetStatement } from '../types';

const statement: FleetStatement = {
  fleetName: 'Fan; Courier',
  cui: 'RO123',
  stationName: 'ITP Cluj',
  month: '2026-09',
  rows: [
    { date: '2026-09-04', plate: 'CJ 01 FAN', brand: 'Dacia', model: 'Logan', status: 'PASSED', validityMonths: 12, price: 150 },
    { date: '2026-09-20', plate: 'CJ 02 FAN', brand: null, model: null, status: 'FAILED', validityMonths: null, price: 100.5 },
  ],
  total: 250.5,
};

describe('parsePlates', () => {
  it('splits lines, commas and semicolons and uppercases', () => {
    expect(parsePlates('cj 01 abc\nB 22 XYZ, cj03def;\n\n')).toEqual(['CJ 01 ABC', 'B 22 XYZ', 'CJ03DEF']);
  });
});

describe('expiryState', () => {
  it('classifies days left', () => {
    expect(expiryState({ daysLeft: null })).toBe('none');
    expect(expiryState({ daysLeft: -1 })).toBe('expired');
    expect(expiryState({ daysLeft: 30 })).toBe('soon');
    expect(expiryState({ daysLeft: 31 })).toBe('ok');
  });
});

describe('months', () => {
  it('labels and lists recent months across the year boundary', () => {
    expect(monthLabel('2026-09')).toBe('septembrie 2026');
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('statement exports', () => {
  it('builds an Excel-friendly CSV with a total row', () => {
    const csv = statementCsv(statement).split('\r\n');
    expect(csv[0]).toBe('sep=;');
    expect(csv[1]).toBe('Centralizator ITP;"Fan; Courier";RO123;septembrie 2026');
    expect(csv[3]).toBe('04.09.2026;CJ 01 FAN;Dacia;Logan;Admis;12;150,00');
    expect(csv[4]).toBe('20.09.2026;CJ 02 FAN;;;Respins;;100,50');
    expect(csv[5]).toBe('TOTAL (2 ITP);;;;;;250,50');
  });

  it('escapes names in the printable page', () => {
    const html = statementHtml({ ...statement, fleetName: '<b>X</b>' });
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).toContain('Total (2 ITP)');
  });
});
