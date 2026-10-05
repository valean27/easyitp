import { describe, expect, it } from 'vitest';
import { convert, guessMapping, headerIndex, parseAnyDate, parseCsv, toCanonicalCsv } from './importMapping';

describe('importMapping', () => {
  it('guesses the columns of our own export and of other apps', () => {
    const own = guessMapping([
      'Nume sofer', 'Contact', 'Marca vehicul', 'VIN', 'Numar inmatriculare', 'Data efectuare ITP',
      'Perioada valabilitate ITP (luni)', 'Data urmatorul ITP', 'Zile ramase ITP',
    ]);
    expect(own).toMatchObject({ name: 0, phone: 1, brand: 2, vin: 3, plate: 4, testDate: 5, validity: 6, expiry: 7 });

    const other = guessMapping(['Nr. crt', 'Client', 'Telefon mobil', 'Nr. auto', 'Marcă', 'Model', 'Serie șasiu', 'Expiră la']);
    expect(other).toMatchObject({ name: 1, phone: 2, plate: 3, brand: 4, model: 5, vin: 6, expiry: 7, testDate: -1 });
  });

  it('parses CSV with semicolons and quotes', () => {
    expect(parseCsv('a;b;c\r\n"x; y";"he said ""hi""";3\n')).toEqual([
      ['a', 'b', 'c'],
      ['x; y', 'he said "hi"', '3'],
    ]);
    expect(parseCsv('﻿n,t\nIon,072')).toEqual([['n', 't'], ['Ion', '072']]);
  });

  it('reads the usual date formats', () => {
    expect(parseAnyDate('12.03.2026')).toBe('2026-03-12');
    expect(parseAnyDate('1/3/26')).toBe('2026-03-01');
    expect(parseAnyDate('2026-03-12T00:00:00')).toBe('2026-03-12');
    expect(parseAnyDate('12-mar.-2026')).toBe('2026-03-12');
    expect(parseAnyDate('12 martie 2026')).toBe('2026-03-12');
    expect(parseAnyDate('46093')).toBe('2026-03-12');
    expect(parseAnyDate('31.02.2026')).toBeNull();
    expect(parseAnyDate('ieri')).toBeNull();
  });

  it('fills validity and the ITP date from the expiry date', () => {
    const mapping = guessMapping(['Client', 'Nr auto', 'Marca', 'Model', 'Data ITP', 'Expira']);
    const { rows, problems } = convert(
      [
        ['Ion Pop', 'CJ01ABC', 'Dacia', 'Logan', '12.03.2025', '12.03.2027'],
        ['Ana', 'B22XYZ', 'Ford', '', '', '01.06.2026'],
        ['', 'B33', 'Ford', '', '01.01.2026', ''],
        ['', '', '', '', '', ''],
      ],
      mapping,
      12
    );
    expect(rows[0]).toMatchObject({ car: 'Dacia Logan', testDate: '2025-03-12', validity: 24, expiry: '2027-03-12' });
    expect(rows[1]).toMatchObject({ testDate: '2025-06-01', validity: 12, expiry: '2026-06-01' });
    expect(problems).toEqual(['Linia 4: lipsește numele']);
    expect(toCanonicalCsv([rows[0]]).split('\n')[1]).toBe('Ion Pop,,Dacia Logan,,CJ01ABC,2025-03-12,24');
  });

  it('skips title rows above the header', () => {
    expect(headerIndex([['Raport ITP 2026'], [], ['Nume', 'Nr auto', 'Data']])).toBe(2);
  });
});
