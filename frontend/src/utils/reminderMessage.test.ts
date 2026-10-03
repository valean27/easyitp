import { describe, expect, it } from 'vitest';
import { normalizePhone, renderReminder, smsLink, whatsappLink, type ReminderMessageData } from './reminderMessage';

const data: ReminderMessageData = {
  nume: 'Ion Pop',
  numar: 'CJ 01 ABC',
  masina: 'Dacia Logan',
  dataExpirare: '2026-10-15',
  expirat: false,
  statie: 'ITP Cluj',
  adresa: 'Str. A 1',
  telefon: '0711 222 333',
};

describe('renderReminder', () => {
  it('fills the default template', () => {
    expect(renderReminder(null, data)).toBe(
      'Bună ziua, Ion Pop! Vă reamintim că ITP-ul pentru CJ 01 ABC expiră pe 15.10.2026. ' +
        'Vă așteptăm la ITP Cluj. Adresa: Str. A 1. Programări la 0711 222 333.'
    );
  });

  it('uses past tense for expired ITP', () => {
    expect(renderReminder(null, { ...data, expirat: true })).toContain('a expirat pe 15.10.2026');
  });

  it('drops sentences whose placeholders are empty', () => {
    const text = renderReminder(null, { ...data, adresa: '', telefon: null });
    expect(text).toContain('Vă așteptăm la ITP Cluj.');
    expect(text).not.toContain('Adresa');
    expect(text).not.toContain('Programări');
  });

  it('supports custom templates and repeated placeholders', () => {
    expect(renderReminder('{nume}: {masina} {numar}, {numar}.', data)).toBe('Ion Pop: Dacia Logan CJ 01 ABC, CJ 01 ABC.');
  });
});

describe('normalizePhone', () => {
  it('converts Romanian numbers to international format', () => {
    expect(normalizePhone('0722 111 222')).toBe('40722111222');
    expect(normalizePhone('+40 722 111 222')).toBe('40722111222');
    expect(normalizePhone('0040722111222')).toBe('40722111222');
  });

  it('rejects missing or too short numbers', () => {
    expect(normalizePhone('722')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('links', () => {
  it('encodes the message', () => {
    expect(whatsappLink('40722111222', 'a b&c')).toBe('https://wa.me/40722111222?text=a%20b%26c');
    expect(smsLink('40722111222', 'a b&c')).toBe('sms:+40722111222?&body=a%20b%26c');
  });
});
