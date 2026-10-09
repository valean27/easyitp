// Programarile de azi pastrate pe dispozitiv, ca aplicatia sa le arate si fara internet (doar citire).
// Se pastreaza doar ziua curenta si doar pentru contul logat; la iesirea din cont se sterg.

const PREFIX = 'easyitp_offline:';

export interface Snapshot<T> {
  data: T;
  savedAt: string; // ISO, cand a fost salvata
}

function key(name: string, account: string) {
  return `${PREFIX}${account}:${name}`;
}

export function saveToday<T>(name: string, account: string, day: string, data: T, now = new Date()): void {
  try {
    localStorage.setItem(key(name, account), JSON.stringify({ day, data, savedAt: now.toISOString() }));
  } catch {
    /* spatiu plin sau stocare blocata: aplicatia merge si fara copie */
  }
}

// Copia de azi (null daca lipseste sau e din alta zi)
export function loadToday<T>(name: string, account: string, day: string): Snapshot<T> | null {
  try {
    const raw = localStorage.getItem(key(name, account));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day: string; data: T; savedAt: string };
    return parsed.day === day ? { data: parsed.data, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

export function clearOffline(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nimic de sters */
  }
}

// Eroare de retea (fara raspuns de la server), nu o eroare a serverului
export function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; code?: string };
  return !e?.response && (e?.code === 'ERR_NETWORK' || e?.code === 'ECONNABORTED' || !navigator.onLine);
}

// "14:32" din momentul salvarii
export function savedTime(savedAt: string): string {
  const d = new Date(savedAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
