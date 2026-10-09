// Aplicatia instalabila (PWA) si notificarile push pe dispozitivul curent

import { removePushSubscription, savePushSubscription } from '../api/pushApi';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Se apeleaza o singura data, la pornire: Chrome / Edge / Android trimit evenimentul devreme, inainte de orice pagina
export function setupDevice() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    listeners.forEach((l) => l());
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const canInstall = () => installEvent !== null;

export async function install(): Promise<boolean> {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}

// Deschisa ca aplicatie (de pe ecranul principal), nu in browser
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // iPad cu iPadOS se prezinta drept Mac, dar are ecran tactil
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Cheia publica VAPID (base64url) -> octetii ceruti de pushManager.subscribe
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Cere permisiunea, aboneaza browserul si trimite abonamentul serverului. Intoarce motivul daca nu merge.
export async function enablePush(publicKey: string): Promise<{ ok: true; devices: number } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: 'Browserul acesta nu primește notificări.' };
  const reg = (await registration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notificările sunt blocate. Le permiteți din setările browserului pentru acest site.' };
  }
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const { devices } = await savePushSubscription(sub.toJSON());
  return { ok: true, devices };
}

export async function disablePush(token?: string): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint, token).catch(() => undefined);
  await sub.unsubscribe().catch(() => false);
}
