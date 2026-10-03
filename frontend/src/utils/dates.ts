// Backend-ul lucreaza cu LocalDateTime (ora locala, fara fus orar), deci nu folosim toISOString (UTC)

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function todayIso(): string {
  return toLocalIso(new Date()).slice(0, 10);
}

export function formatTime(iso: string): string {
  return iso.slice(11, 16);
}
