import type { StationDeadline, StationDeadlineKind } from '../types';

export const STATION_DEADLINE_KINDS: { kind: StationDeadlineKind; label: string; titleLabel: string; placeholder: string }[] = [
  { kind: 'AUTORIZATIE_RAR', label: 'Autorizația RAR', titleLabel: 'Număr / observație', placeholder: 'ex. Autorizația nr. 1234' },
  { kind: 'METROLOGIE', label: 'Verificare metrologică', titleLabel: 'Echipament', placeholder: 'ex. Banc de frânare, analizor gaze' },
  { kind: 'ATESTAT_INSPECTOR', label: 'Atestat inspector', titleLabel: 'Inspector', placeholder: 'Numele inspectorului' },
  { kind: 'ALTUL', label: 'Alt termen', titleLabel: 'Ce anume', placeholder: 'ex. Asigurarea clădirii, ISU' },
];

// "expirat de 2 zile" / "azi" / "în 12 zile"
export function daysText(days: number): string {
  if (days < 0) return `expirat de ${Math.abs(days)} ${Math.abs(days) === 1 ? 'zi' : 'zile'}`;
  if (days === 0) return 'expiră azi';
  return `expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

// Cele care cer atentie, cele expirate si mai apropiate primele
export function dueFirst(list: StationDeadline[]): StationDeadline[] {
  return list.filter((d) => d.due).sort((a, b) => a.daysLeft - b.daysLeft);
}
