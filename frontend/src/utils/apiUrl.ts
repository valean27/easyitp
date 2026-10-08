// Adresa completa a unui fisier servit de backend (ex. logo-ul statiei "/api/public/logos/…png").
// In dezvoltare baza e goala: Vite trimite /api la backend.
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  return base + path;
}
