import type { ItpFormData } from '../types';

// Aceleasi reguli ca ItpService.validate pe server: fiecare greseala la campul ei, ca formularul sa-l marcheze cu rosu
export type ItpField =
  | 'licensePlate'
  | 'name'
  | 'phone'
  | 'brand'
  | 'year'
  | 'vin'
  | 'testDate'
  | 'validityMonths'
  | 'mileage'
  | 'price';

export type ItpErrors = Partial<Record<ItpField, string>>;

// ordinea din formular: la salvare derulam la prima greseala
export const FIELD_ORDER: ItpField[] = ['licensePlate', 'name', 'phone', 'brand', 'year', 'vin', 'testDate', 'validityMonths', 'mileage', 'price'];

const plateKey = (p: string) => p.replace(/[\s-]/g, '').toUpperCase();

export function vinProblem(raw: string | null | undefined): string | null {
  const vin = (raw ?? '').trim().toUpperCase();
  if (!vin) return null;
  if (!/^[A-Z0-9]+$/.test(vin)) return 'VIN-ul are doar litere și cifre, fără spații sau semne';
  if (/[IOQ]/.test(vin)) return 'VIN-ul nu conține literele I, O sau Q (sunt cifrele 1 și 0)';
  if (vin.length !== 17) return `VIN-ul are 17 caractere (acum are ${vin.length})`;
  return null;
}

export function validateItp(form: ItpFormData, today: string, currentYear: number): ItpErrors {
  const e: ItpErrors = {};
  const plate = plateKey(form.licensePlate ?? '');
  if (plate.length < 2) e.licensePlate = 'Introduceți numărul de înmatriculare';
  else if (plate.length > 15) e.licensePlate = 'Numărul de înmatriculare este prea lung';

  const name = (form.name ?? '').trim();
  if (!name) e.name = 'Introduceți numele clientului';
  else if (name.length > 120) e.name = 'Numele este prea lung';

  const digits = (form.phone ?? '').replace(/\D/g, '').length;
  if ((form.phone ?? '').trim() && (digits < 9 || digits > 15)) e.phone = 'Numărul de telefon nu pare complet';

  if (!(form.brand ?? '').trim()) e.brand = 'Alegeți sau adăugați marca';

  if (form.year != null && (form.year < 1900 || form.year > currentYear + 1)) e.year = 'An de fabricație invalid';

  const vin = vinProblem(form.vin);
  if (vin) e.vin = vin;

  if (!form.testDate) e.testDate = 'Introduceți data ITP';
  else if (form.testDate > today) e.testDate = 'Data ITP nu poate fi în viitor';
  else if (form.testDate < '1990-01-01') e.testDate = 'Data ITP este prea veche';

  if (!form.validityMonths || form.validityMonths < 1 || form.validityMonths > 36) {
    e.validityMonths = 'Valabilitatea trebuie să fie între 1 și 36 de luni';
  }
  if (form.mileage != null && (form.mileage < 0 || form.mileage > 5_000_000)) e.mileage = 'Kilometraj invalid';
  if (form.price != null && (form.price < 0 || form.price > 100_000)) e.price = 'Preț invalid';
  return e;
}

export function firstError(errors: ItpErrors): ItpField | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null;
}
