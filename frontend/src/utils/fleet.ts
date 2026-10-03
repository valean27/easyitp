import type { FleetStatement, FleetVehicle, ItpStatus } from '../types';

export const EXPIRING_DAYS = 30;

const MONTHS_LONG = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

export const STATUS_LABELS: Record<ItpStatus, string> = {
  PASSED: 'Admis',
  FAILED: 'Respins',
  RECHECK: 'Reverificare',
};

// Lista lipita de manager: un numar pe linie sau separate prin virgula / punct si virgula
export function parsePlates(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p.length > 0);
}

export type ExpiryState = 'none' | 'expired' | 'soon' | 'ok';

export function expiryState(v: Pick<FleetVehicle, 'daysLeft'>): ExpiryState {
  if (v.daysLeft == null) return 'none';
  if (v.daysLeft < 0) return 'expired';
  return v.daysLeft <= EXPIRING_DAYS ? 'soon' : 'ok';
}

// "2026-09-04" -> "04.09.2026"
export function formatDateRo(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// "2026-09" -> "septembrie 2026"
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

// Ultimele n luni, cea curenta prima ("2026-10", "2026-09", ...)
export function recentMonths(n: number, today = new Date()): string[] {
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

const money = (v: number) => v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// CSV pentru Excel (separator ";" si virgula zecimala, ca exportul din Rapoarte)
export function statementCsv(st: FleetStatement): string {
  const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    'sep=;',
    `Centralizator ITP;${cell(st.fleetName)};${cell(st.cui ?? '')};${monthLabel(st.month)}`,
    'Data;Nr. inmatriculare;Marca;Model;Rezultat;Valabilitate (luni);Pret (RON)',
    ...st.rows.map((r) =>
      [
        formatDateRo(r.date),
        cell(r.plate),
        cell(r.brand ?? ''),
        cell(r.model ?? ''),
        STATUS_LABELS[r.status],
        r.validityMonths ?? '',
        r.price != null ? money(r.price) : '',
      ].join(';')
    ),
    `TOTAL (${st.rows.length} ITP);;;;;;${money(st.total)}`,
  ];
  return lines.join('\r\n');
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Pagina tiparibila (Salveaza ca PDF din dialogul de tiparire al browserului)
export function statementHtml(st: FleetStatement): string {
  const rows = st.rows
    .map(
      (r) => `<tr><td>${formatDateRo(r.date)}</td><td><b>${escapeHtml(r.plate)}</b></td>
        <td>${escapeHtml([r.brand, r.model].filter(Boolean).join(' '))}</td><td>${STATUS_LABELS[r.status]}</td>
        <td class="n">${r.price != null ? money(r.price) : ''}</td></tr>`
    )
    .join('');
  const title = `Centralizator ITP – ${escapeHtml(st.fleetName)} – ${monthLabel(st.month)}`;
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1e293b;margin:32px}
  h1{font-size:20px;margin:0 0 4px} p{margin:2px 0;color:#475569;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #e2e8f0} th{background:#f1f5f9;font-weight:600}
  .n{text-align:right} tfoot td{font-weight:700;border-top:2px solid #94a3b8}
  .note{margin-top:24px;font-size:11px;color:#94a3b8}
</style></head><body>
<h1>Centralizator ITP · ${monthLabel(st.month)}</h1>
<p><b>${escapeHtml(st.fleetName)}</b>${st.cui ? ` · CUI ${escapeHtml(st.cui)}` : ''}</p>
${st.stationName ? `<p>Stația ITP: ${escapeHtml(st.stationName)}</p>` : ''}
<table><thead><tr><th>Data</th><th>Nr. înmatriculare</th><th>Vehicul</th><th>Rezultat</th><th class="n">Preț (RON)</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">Niciun ITP în această lună.</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">Total (${st.rows.length} ITP)</td><td class="n">${money(st.total)}</td></tr></tfoot></table>
<p class="note">Document informativ generat de EasyITP. Factura fiscală se emite separat de stația ITP.</p>
</body></html>`;
}
