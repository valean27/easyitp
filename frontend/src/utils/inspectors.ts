import type { Appointment, Inspector, InspectorColor, InspectorDashboard, InspectorStats } from '../types';

// Culorile inspectorilor: paleta categoriala validata (aceeasi ordine ca InspectorService.COLORS), cate o nuanta
// pentru tema luminoasa si una pentru cea intunecata. Culoarea tine de om, nu de locul din clasament.
export const INSPECTOR_COLORS: Record<InspectorColor, { light: string; dark: string; label: string }> = {
  blue: { light: '#2a78d6', dark: '#3987e5', label: 'Albastru' },
  orange: { light: '#eb6834', dark: '#d95926', label: 'Portocaliu' },
  aqua: { light: '#1baf7a', dark: '#199e70', label: 'Verde-albastru' },
  yellow: { light: '#eda100', dark: '#c98500', label: 'Galben' },
  magenta: { light: '#e87ba4', dark: '#d55181', label: 'Roz' },
  green: { light: '#008300', dark: '#008300', label: 'Verde' },
  violet: { light: '#4a3aa7', dark: '#9085e9', label: 'Violet' },
  red: { light: '#e34948', dark: '#e66767', label: 'Roșu' },
};
export const COLOR_ORDER = Object.keys(INSPECTOR_COLORS) as InspectorColor[];
// ITP-urile fara inspector si numele vechi: gri
const NEUTRAL = { light: '#94a3b8', dark: '#64748b' };

export function colorHex(color: InspectorColor | null | undefined, mode: 'light' | 'dark'): string {
  return color ? INSPECTOR_COLORS[color][mode] : NEUTRAL[mode];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Inspectorul unei programari: cel ales anume sau cel de pe linia ei
export function appointmentInspector(a: Pick<Appointment, 'inspectorId' | 'lineInspectorId'>, team: Inspector[]): Inspector | undefined {
  const id = a.inspectorId ?? a.lineInspectorId;
  return id == null ? undefined : team.find((i) => i.id === id);
}

// Rata de respingere (respinse / ITP-uri), in procente
export function failRate(s: Pick<InspectorStats, 'itps' | 'failed'>): number {
  return s.itps ? Math.round((s.failed * 100) / s.itps) : 0;
}

export function perDay(s: Pick<InspectorStats, 'itps' | 'daysWorked'>): number {
  return s.daysWorked ? Math.round((s.itps * 10) / s.daysWorked) / 10 : 0;
}

export type Period = 'month' | 'lastMonth' | 'week' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'Ultimele 7 zile',
  month: 'Luna aceasta',
  lastMonth: 'Luna trecută',
  year: 'Anul acesta',
};

const iso = (d: Date) => d.toLocaleDateString('sv-SE');

// Intervalul [from, to] al perioadei, fata de ziua "today" (yyyy-mm-dd)
export function periodRange(period: Period, today: string): { from: string; to: string } {
  const [y, m, d] = today.split('-').map(Number);
  switch (period) {
    case 'week':
      return { from: iso(new Date(y, m - 1, d - 6)), to: today };
    case 'month':
      return { from: iso(new Date(y, m - 1, 1)), to: today };
    case 'lastMonth':
      return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m - 1, 0)) };
    case 'year':
      return { from: iso(new Date(y, 0, 1)), to: today };
  }
}

export interface Bar {
  label: string;
  title: string; // pentru tooltip
  total: number;
  segments: { key: string; count: number }[];
}

const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

// Barele graficului: pe zile pana la 62 de zile, altfel pe luni; segmentele in ordinea seriilor (keys)
export function chartBars(days: InspectorDashboard['days'], keys: string[]): Bar[] {
  const monthly = days.length > 62;
  const groups = new Map<string, { label: string; title: string; counts: Map<string, number> }>();
  for (const day of days) {
    const [y, m, d] = day.date.split('-').map(Number);
    const id = monthly ? `${y}-${m}` : day.date;
    const g = groups.get(id) ?? {
      label: monthly ? MONTHS_SHORT[m - 1] : String(d),
      title: monthly ? `${MONTHS_SHORT[m - 1]} ${y}` : `${d} ${MONTHS_SHORT[m - 1]} ${y}`,
      counts: new Map<string, number>(),
    };
    for (const c of day.byInspector) {
      const key = keys.includes(c.key) ? c.key : 'other';
      g.counts.set(key, (g.counts.get(key) ?? 0) + c.count);
    }
    groups.set(id, g);
  }
  return [...groups.values()].map((g) => {
    const segments = [...keys, 'other'].filter((k) => g.counts.get(k)).map((key) => ({ key, count: g.counts.get(key)! }));
    return { label: g.label, title: g.title, total: segments.reduce((s, x) => s + x.count, 0), segments };
  });
}
