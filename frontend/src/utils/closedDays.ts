import type { ClosedDay } from '../types';
import { MONTHS_SHORT } from './booking';

// Zilele fara programari online (sarbatori legale si zile inchise de statie), dupa data "yyyy-mm-dd"
export function closedMap(days: ClosedDay[] | null | undefined): Map<string, ClosedDay> {
  return new Map((days ?? []).map((d) => [d.date, d]));
}

// "1 dec." din "2026-12-01"
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}.`;
}

// Textul de sub zile pe pagina de programare: "Închis: 30 nov. (Sfântul Andrei), 1 dec. (Ziua Națională)"
// (zilele la rand cu acelasi motiv apar ca o perioada: "12 oct. – 13 oct. (Inventar)")
export function closedNotice(days: ClosedDay[] | null | undefined, limit = 3): string | null {
  if (!days?.length) return null;
  const ranges = closedRanges(days);
  const shown = ranges.slice(0, limit).map((r) => (r.name ? `${rangeText(r)} (${r.name})` : rangeText(r)));
  const more = ranges.length > limit ? ` și încă ${ranges.length - limit}` : '';
  return `Închis: ${shown.join(', ')}${more}.`;
}

const nextIso = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Zilele inchise de statie grupate pe perioade (zile la rand, cu aceeasi nota)
export function closedRanges(days: ClosedDay[]): { from: string; to: string; name: string | null }[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const out: { from: string; to: string; name: string | null }[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && nextIso(last.to) === d.date && (last.name ?? '') === (d.name ?? '')) last.to = d.date;
    else out.push({ from: d.date, to: d.date, name: d.name });
  }
  return out;
}

export function rangeText(r: { from: string; to: string }): string {
  return r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} – ${shortDate(r.to)}`;
}

// "12:00–12:30" sau null fara pauza
export function breakText(start: string | null | undefined, end: string | null | undefined): string | null {
  return start && end ? `${start.slice(0, 5)}–${end.slice(0, 5)}` : null;
}
