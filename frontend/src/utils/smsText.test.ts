import { describe, expect, it } from 'vitest';
import { plainSms, renderSms, smsSegments } from './smsText';

const DEFAULT = '{statie}: ITP-ul pentru {numar} {expira} {data}. Programari la {telefon}. Online: {link}';
const data = {
  nume: 'Ion',
  numar: 'CJ 01 ABC',
  masina: 'Dacia',
  dataExpirare: '2026-11-03',
  expirat: false,
  statie: 'ITP Ștefănești',
  adresa: null,
  telefon: '0722 111 222',
  link: null,
  stop: 'https://x.ro/stop/abc',
};

describe('sms text', () => {
  it('matches the server rendering', () => {
    expect(renderSms('', DEFAULT, data)).toBe(
      'ITP Stefanesti: ITP-ul pentru CJ 01 ABC expira pe 03.11.2026. Programari la 0722 111 222.\nDezabonare: https://x.ro/stop/abc'
    );
  });

  it('strips diacritics and counts parts', () => {
    expect(plainSms('Mașină „ok”')).toBe('Masina "ok"');
    expect(smsSegments('a'.repeat(160))).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
  });
});
