// Detecteaza cand serverul raspunde greu (Render free porneste in pana la un minut dupa ce a adormit),
// ca interfata sa poata spune "serverul porneste" in loc sa para blocata
export const SLOW_AFTER_MS = 4000;

// Cereri care dureaza firesc mai mult (scanarea talonului, importul CSV, emailul de test)
const NATURALLY_SLOW = ['/scan-registration', '/import', '/digest/test'];

type Listener = (slow: boolean) => void;

const listeners = new Set<Listener>();
let pending = 0;
let slow = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function setSlow(value: boolean) {
  if (slow === value) return;
  slow = value;
  listeners.forEach((l) => l(value));
}

export function isNaturallySlow(url: string | undefined): boolean {
  return !!url && NATURALLY_SLOW.some((part) => url.includes(part));
}

export function requestStarted() {
  pending++;
  if (pending === 1) timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
}

export function requestFinished() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimeout(timer);
    setSlow(false);
  }
}

export function subscribeSlow(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSlow(): boolean {
  return slow;
}
