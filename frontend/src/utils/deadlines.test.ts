import { describe, expect, it } from 'vitest';
import { deadlineMessage, deadlinePayload, deadlineSummary } from './deadlines';

describe('deadlines', () => {
  it('sends every kind, with null for the cleared ones', () => {
    expect(deadlinePayload({ RCA: '2027-03-12', ROVINIETA: '' })).toEqual({
      RCA: '2027-03-12',
      ROVINIETA: null,
      TAHOGRAF: null,
    });
  });

  it('summarises only the filled dates', () => {
    expect(deadlineSummary({ RCA: '2027-03-12', TAHOGRAF: '2026-11-01' })).toBe('RCA 12.03.2027 · Tahograf 01.11.2026');
    expect(deadlineSummary({})).toBe('');
    expect(deadlineSummary(null)).toBe('');
  });

  it('builds the manual message', () => {
    const text = deadlineMessage({
      nume: 'Ana',
      numar: 'CJ01ABC',
      tip: 'RCA',
      data: '2026-10-12',
      expirat: false,
      statie: 'ITP Nord',
      telefon: '0722 999 999',
      stop: 'https://easyitp.vercel.app/s/abc',
    });
    expect(text).toBe(
      'Bună ziua, Ana! RCA pentru CJ01ABC expiră pe 12.10.2026. Pentru detalii ne găsiți la 0722 999 999. ITP Nord\nDezabonare: https://easyitp.vercel.app/s/abc'
    );
    expect(deadlineMessage({ nume: '', numar: 'B1', tip: 'Rovinietă', data: '2026-01-02', expirat: true, statie: null, telefon: null, stop: null }))
      .toBe('Bună ziua! Rovinietă pentru B1 a expirat pe 02.01.2026.');
  });
});
