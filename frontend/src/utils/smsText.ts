import { renderReminder, type ReminderMessageData } from './reminderMessage';

// Previzualizarea SMS-ului automat; aceeasi regula ca pe server (SmsText.java): fara diacritice (altfel un SMS
// are 70 de caractere in loc de 160), iar link-ul de dezabonare pe ultimul rand
export function plainSms(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[„”]/g, '"')
    .replace(/’/g, "'")
    .replace(/–/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '');
}

export function renderSms(template: string, defaultTemplate: string, data: ReminderMessageData): string {
  const text = template.trim() || defaultTemplate;
  const hasStop = text.includes('{stop}');
  const body = renderReminder(text, { ...data, stop: hasStop ? data.stop : null });
  return plainSms(!hasStop && data.stop ? `${body}\nDezabonare: ${data.stop}` : body);
}

// Cate SMS-uri se taxeaza: 160 de caractere unul singur, 153 pe parte cand e lung
export function smsSegments(text: string): number {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}
