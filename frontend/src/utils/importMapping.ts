// Importul din Excel / alte aplicatii (E2): citim fisierul in browser, ghicim ce coloana e ce, iar statia poate
// corecta potrivirea. Randurile se transforma in CSV-ul nostru (acelasi format ca exportul) si merg la importul
// existent, care potriveste clientii, nu dubleaza nimic si scrie in istoric.

export type FieldKey = 'name' | 'phone' | 'plate' | 'brand' | 'model' | 'vin' | 'testDate' | 'validity' | 'expiry';

export const FIELDS: { key: FieldKey; label: string; strong: string[]; weak: string[] }[] = [
  { key: 'plate', label: 'Număr de înmatriculare', strong: ['inmatricul', 'numar auto', 'nr auto', 'plate', 'registration'], weak: ['numar', 'nr'] },
  { key: 'expiry', label: 'Data expirării ITP', strong: ['expir', 'scaden', 'urmator', 'valabil pana', 'valabilitate pana', 'next'], weak: [] },
  { key: 'testDate', label: 'Data ITP', strong: ['data itp', 'data inspect', 'efectuare', 'data verific', 'data ultim'], weak: ['data', 'date'] },
  { key: 'validity', label: 'Valabilitate (luni)', strong: ['valabilitate', 'perioada', 'luni'], weak: [] },
  { key: 'vin', label: 'VIN / serie șasiu', strong: ['vin', 'sasiu', 'serie caroserie'], weak: ['serie'] },
  { key: 'phone', label: 'Telefon', strong: ['telefon', 'mobil', 'phone', 'tel'], weak: ['contact'] },
  { key: 'name', label: 'Nume client', strong: ['nume', 'client', 'proprietar', 'sofer', 'detinator', 'titular', 'beneficiar'], weak: ['name'] },
  { key: 'model', label: 'Model', strong: ['model'], weak: [] },
  { key: 'brand', label: 'Marcă', strong: ['marca', 'make', 'brand'], weak: ['vehicul', 'auto', 'masina'] },
];

export type Mapping = Record<FieldKey, number>;

export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Fiecare camp primeste prima coloana nefolosita care se potriveste: intai cuvintele sigure, apoi cele vagi
export function guessMapping(headers: string[]): Mapping {
  const folded = headers.map(fold);
  const used = new Set<number>();
  const mapping = Object.fromEntries(FIELDS.map((f) => [f.key, -1])) as Mapping;
  for (const pass of ['strong', 'weak'] as const) {
    for (const f of FIELDS) {
      if (mapping[f.key] >= 0) continue;
      const i = folded.findIndex((h, idx) => !used.has(idx) && h !== '' && f[pass].some((w) => (w.length <= 3 ? h.split(' ').includes(w) : h.includes(w))));
      if (i >= 0) {
        mapping[f.key] = i;
        used.add(i);
      }
    }
  }
  return mapping;
}

// CSV cu separator ghicit (virgula, punct si virgula, tab), ghilimele si randuri noi in celule
export function parseCsv(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

const MONTHS: Record<string, number> = {
  ian: 1, jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, iun: 6, jun: 6, iul: 7, jul: 7, aug: 8, sep: 9, oct: 10,
  noi: 11, nov: 11, dec: 12,
};

// Celula din Excel: Date -> "aaaa-ll-zz", restul ca text
export function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).trim();
}

// "12.03.2026", "12/3/26", "2026-03-12", "12-mar.-2026", "12 martie 2026", numarul de serie din Excel (46093)
export function parseAnyDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = fold(s).match(/^(\d{1,2}) ([a-z]{3,}) (\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3)]) return iso(+m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
  }
  return null;
}

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  // 31 ian + 1 luna -> ultima zi din februarie, ca in Java (plusMonths)
  if (date.getDate() !== d) date.setDate(0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthsBetween(from: string, to: string): number {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return Math.round(days / 30.44);
}

export interface ImportRow {
  name: string;
  phone: string;
  plate: string;
  car: string;
  vin: string;
  testDate: string;
  validity: number;
  expiry: string;
}

export interface Converted {
  rows: ImportRow[];
  // randuri care nu pot fi importate, cu motivul (linia din fisier)
  problems: string[];
}

// Randurile fisierului (fara antet) -> randuri complete. Fara valabilitate: din data expirarii sau cea implicita.
// Fara data ITP dar cu data expirarii: data ITP = expirarea minus valabilitatea.
export function convert(rows: unknown[][], mapping: Mapping, defaultValidity: number, firstLine = 2): Converted {
  const get = (r: unknown[], k: FieldKey) => (mapping[k] >= 0 ? cellText(r[mapping[k]]) : '');
  const out: ImportRow[] = [];
  const problems: string[] = [];
  rows.forEach((r, i) => {
    const line = firstLine + i;
    if (r.every((c) => cellText(c) === '')) return;
    const name = get(r, 'name');
    const plate = get(r, 'plate');
    let testDate = parseAnyDate(get(r, 'testDate'));
    const expiryRaw = parseAnyDate(get(r, 'expiry'));
    const validityRaw = parseInt(get(r, 'validity'), 10);
    let validity = validityRaw > 0 && validityRaw <= 36 ? validityRaw : 0;
    if (!validity && testDate && expiryRaw) {
      const months = monthsBetween(testDate, expiryRaw);
      validity = months >= 1 && months <= 36 ? months : 0;
    }
    if (!validity) validity = defaultValidity;
    if (!testDate && expiryRaw) testDate = addMonths(expiryRaw, -validity);

    let problem: string | null = null;
    if (!name) problem = 'lipsește numele';
    else if (!plate) problem = 'lipsește numărul';
    else if (!testDate) problem = 'lipsește data ITP (sau data expirării)';
    if (problem) {
      problems.push(`Linia ${line}: ${problem}`);
      return;
    }
    const brand = get(r, 'brand');
    const model = get(r, 'model');
    out.push({
      name,
      phone: get(r, 'phone'),
      plate,
      car: model && !fold(brand).includes(fold(model)) ? `${brand} ${model}`.trim() : brand,
      vin: get(r, 'vin'),
      testDate: testDate!,
      validity,
      expiry: addMonths(testDate!, validity),
    });
  });
  return { rows: out, problems };
}

const q = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// CSV-ul pe care il intelege importul de pe server (aceleasi coloane ca exportul)
export function toCanonicalCsv(rows: ImportRow[]): string {
  const header = 'Nume sofer,Contact,Marca vehicul,VIN,Numar inmatriculare,Data efectuare ITP,Perioada valabilitate ITP (luni)';
  return [header, ...rows.map((r) => [r.name, r.phone, r.car, r.vin, r.plate, r.testDate, String(r.validity)].map(q).join(','))].join('\n');
}

// Primul rand cu cel putin 2 celule completate e antetul (unele exporturi au un titlu deasupra)
export function headerIndex(rows: unknown[][]): number {
  const i = rows.findIndex((r) => r.filter((c) => cellText(c) !== '').length >= 2);
  return i < 0 ? 0 : i;
}
