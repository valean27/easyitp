// Ajutatoare pentru campul de data (DateField): format romanesc zz.ll.aaaa si grila unei luni (luni prima zi)

export const MONTHS_LONG = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

const pad = (n: number) => String(n).padStart(2, '0');

export const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// "2027-03-12" -> "12.03.2027"
export function formatRo(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : '';
}

// "12.03.2027", "12/3/2027", "12-03-27" -> "2027-03-12"; null daca nu e o data reala
export function parseRo(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return isoOf(y, mo - 1, d);
}

// Pe masura ce se tasteaza cifre: "1203" -> "12.03", "12032027" -> "12.03.2027"
export function maskRo(text: string): string {
  if (/[./-]/.test(text)) return text.slice(0, 10);
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

// 6 saptamani x 7 zile, de luni pana duminica, cu zilele din lunile vecine
export function monthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}

export function inRange(iso: string, min?: string, max?: string): boolean {
  return (!min || iso >= min) && (!max || iso <= max);
}
