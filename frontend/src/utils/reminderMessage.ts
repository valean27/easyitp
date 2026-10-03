// Mesajele de reamintire ITP trimise clientilor pe WhatsApp/SMS

export const DEFAULT_REMINDER_TEMPLATE =
  'Bună ziua, {nume}! Vă reamintim că ITP-ul pentru {numar} {expira} {data}. ' +
  'Vă așteptăm la {statie}. Adresa: {adresa}. Programări la {telefon}. Programare online: {link}';

export const TEMPLATE_PLACEHOLDERS: { key: string; description: string }[] = [
  { key: '{nume}', description: 'numele clientului' },
  { key: '{numar}', description: 'numărul de înmatriculare' },
  { key: '{masina}', description: 'marca și modelul' },
  { key: '{expira}', description: '„expiră pe” sau „a expirat pe”' },
  { key: '{data}', description: 'data expirării ITP' },
  { key: '{statie}', description: 'numele stației' },
  { key: '{adresa}', description: 'adresa stației' },
  { key: '{telefon}', description: 'telefonul stației' },
  { key: '{link}', description: 'link-ul de programare online (dacă e activă)' },
];

export interface ReminderMessageData {
  nume: string;
  numar: string;
  masina: string;
  dataExpirare: string; // yyyy-MM-dd
  expirat: boolean;
  statie: string | null;
  adresa: string | null;
  telefon: string | null;
  // Link-ul de programare online; null daca statia nu o are activa
  link?: string | null;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Propozitiile care contin un placeholder gol (ex. statie fara adresa) sunt eliminate, ca mesajul sa ramana curat
export function renderReminder(template: string | null | undefined, data: ReminderMessageData): string {
  const values: Record<string, string> = {
    '{nume}': data.nume?.trim() ?? '',
    '{numar}': data.numar?.trim() ?? '',
    '{masina}': data.masina?.trim() ?? '',
    '{expira}': data.expirat ? 'a expirat pe' : 'expiră pe',
    '{data}': formatDate(data.dataExpirare),
    '{statie}': data.statie?.trim() ?? '',
    '{adresa}': data.adresa?.trim() ?? '',
    '{telefon}': data.telefon?.trim() ?? '',
    '{link}': data.link?.trim() ?? '',
  };
  const text = (template?.trim() || DEFAULT_REMINDER_TEMPLATE);
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((sentence) => Object.entries(values).every(([key, value]) => !sentence.includes(key) || value !== ''))
    .map((sentence) => Object.entries(values).reduce((acc, [key, value]) => acc.split(key).join(value), sentence))
    .join(' ')
    .trim();
}

// Numar romanesc -> format international fara "+" (ex. 0722 123 456 -> 40722123456); null daca nu e valid
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = '40' + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// "?&body=" functioneaza si pe Android si pe iOS
export function smsLink(phone: string, message: string): string {
  return `sms:+${phone}?&body=${encodeURIComponent(message)}`;
}
