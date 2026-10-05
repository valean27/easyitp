import { describe, expect, it } from 'vitest';
import { firstError, validateItp, vinProblem } from './itpValidation';
import type { ItpFormData } from '../types';

const ok: ItpFormData = {
  name: 'Ion Pop',
  phone: '0722 123 456',
  brand: 'Dacia',
  model: 'Logan',
  year: 2018,
  vin: 'UU1LSDAAH12345678',
  licensePlate: 'CJ 01 ABC',
  testDate: '2026-10-06',
  validityMonths: 12,
  status: 'PASSED',
  mileage: 120000,
  price: 150,
  observations: '',
};

describe('itpValidation', () => {
  it('accepts a correct form', () => {
    expect(validateItp(ok, '2026-10-06', 2026)).toEqual({});
  });

  it('explains what is wrong with a VIN', () => {
    expect(vinProblem('')).toBeNull();
    expect(vinProblem('WVWZZZ1KZ0W')).toBe('VIN-ul are 17 caractere (acum are 11)');
    expect(vinProblem('WVW ZZZ1KZ0W12345')).toBe('VIN-ul are doar litere și cifre, fără spații sau semne');
    expect(vinProblem('WVWZZZ1KZOW123456')).toBe('VIN-ul nu conține literele I, O sau Q (sunt cifrele 1 și 0)');
    expect(vinProblem('wvwzzz1kz0w123456')).toBeNull();
  });

  it('marks each wrong field and finds the first one in form order', () => {
    const errors = validateItp(
      { ...ok, name: ' ', phone: '0722', brand: '', vin: 'abc', testDate: '2026-12-01', year: 1800, price: -1 },
      '2026-10-06',
      2026
    );
    expect(Object.keys(errors).sort()).toEqual(['brand', 'name', 'phone', 'price', 'testDate', 'vin', 'year']);
    expect(errors.testDate).toBe('Data ITP nu poate fi în viitor');
    expect(firstError(errors)).toBe('name');
    expect(firstError({})).toBeNull();
  });
});
