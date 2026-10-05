import type { DeadlineDates, DeadlineKind } from '../types';
import { formatDateRo } from './fleet';

export const DEADLINE_KINDS: { kind: DeadlineKind; label: string; hint: string }[] = [
  { kind: 'RCA', label: 'RCA', hint: 'Asigurarea obligatorie' },
  { kind: 'ROVINIETA', label: 'Rovinietă', hint: 'Taxa de drum' },
  { kind: 'TAHOGRAF', label: 'Tahograf', hint: 'Verificarea periodică (camioane, autocare)' },
];

export const deadlineLabel = (kind: DeadlineKind): string => DEADLINE_KINDS.find((k) => k.kind === kind)?.label ?? kind;

// Ce trimitem la salvare: fiecare tip, cu null pentru cele golite (ca sa fie sterse)
export function deadlinePayload(dates: DeadlineDates): Record<DeadlineKind, string | null> {
  const out = {} as Record<DeadlineKind, string | null>;
  DEADLINE_KINDS.forEach(({ kind }) => {
    out[kind] = dates[kind] || null;
  });
  return out;
}

// "RCA 12.03.2027 · Rovinietă 01.05.2027", doar cele completate
export function deadlineSummary(dates: DeadlineDates | null | undefined): string {
  if (!dates) return '';
  return DEADLINE_KINDS.filter(({ kind }) => dates[kind])
    .map(({ kind, label }) => `${label} ${formatDateRo(dates[kind]!)}`)
    .join(' · ');
}

export interface DeadlineMessageData {
  nume: string;
  numar: string;
  tip: string;
  data: string;
  expirat: boolean;
  statie: string | null;
  telefon: string | null;
  stop: string | null;
}

// Mesajul trimis manual (WhatsApp / SMS de pe telefon) pentru RCA / rovinieta / tahograf
export function deadlineMessage(d: DeadlineMessageData): string {
  const parts = [
    `Bună ziua${d.nume ? `, ${d.nume}` : ''}!`,
    `${d.tip} pentru ${d.numar} ${d.expirat ? 'a expirat pe' : 'expiră pe'} ${formatDateRo(d.data)}.`,
  ];
  if (d.telefon) parts.push(`Pentru detalii ne găsiți la ${d.telefon}.`);
  if (d.statie) parts.push(`${d.statie}`);
  let text = parts.join(' ');
  if (d.stop) text += `\nDezabonare: ${d.stop}`;
  return text;
}
