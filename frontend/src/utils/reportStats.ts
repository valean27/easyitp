import type { InspectorMonth } from '../types';

export interface InspectorTotal {
  inspector: string;
  count: number;
  failed: number;
  recheck: number;
  revenue: number;
}

export const UNKNOWN_INSPECTOR = 'Nespecificat';

// Totalurile fiecarui inspector pe o luna (1-12) sau pe tot anul (null), cele mai multe verificari primele.
// ITP-urile fara inspector ("Nespecificat") sunt mereu la final, ca sa nu para un om din echipa.
export function inspectorTotals(rows: InspectorMonth[], month: number | null): InspectorTotal[] {
  const totals = new Map<string, InspectorTotal>();
  for (const r of rows) {
    if (month !== null && r.month !== month) continue;
    const t = totals.get(r.inspector) ?? { inspector: r.inspector, count: 0, failed: 0, recheck: 0, revenue: 0 };
    t.count += r.count;
    t.failed += r.failed;
    t.recheck += r.recheck;
    t.revenue += r.revenue;
    totals.set(r.inspector, t);
  }
  return [...totals.values()].sort((a, b) => {
    const unknown = Number(a.inspector === UNKNOWN_INSPECTOR) - Number(b.inspector === UNKNOWN_INSPECTOR);
    return unknown !== 0 ? unknown : b.count - a.count || a.inspector.localeCompare(b.inspector);
  });
}

// Lunile (1-12) in care exista ITP-uri cu inspector, pentru selectorul de perioada
export function monthsWithData(rows: InspectorMonth[]): number[] {
  return [...new Set(rows.map((r) => r.month))].sort((a, b) => a - b);
}
