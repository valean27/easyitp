// Trimiterea cozii offline (utils/outbox.ts) cand revine internetul: in ordine, una cate una.
// Fara retea sau eroare de server: se opreste si reincearca mai tarziu. Refuzata (409 / 400 / 404): ajunge in "De rezolvat".
import api from '../api/axiosInstance';
import type { Appointment } from '../types';
import { currentAccount, load, remove, toConflicts, type OutboxItem } from './outbox';
import { isNetworkError } from './offline';

export const SYNCED_EVENT = 'easyitp-synced';
export const SYNCING_EVENT = 'easyitp-syncing';

let running = false;

export const isSyncing = () => running;

function send(item: OutboxItem): Promise<unknown> {
  switch (item.kind) {
    case 'create':
      return api.post('/api/appointments', item.payload);
    case 'update':
      return api.put(`/api/appointments/${item.id}`, { ...item.payload, version: item.version ?? null, offline: true });
    case 'delete':
      return api.delete(`/api/appointments/${item.id}`, { params: item.version != null ? { version: item.version } : {} });
    case 'status':
      return api.put(`/api/inspector-portal/appointments/${item.id}/status`, { ...item.payload, version: item.version ?? null });
    case 'itp':
      return api.post(`/api/inspector-portal/appointments/${item.id}/itp`, item.payload);
  }
}

export async function syncOutbox(): Promise<void> {
  const account = currentAccount();
  if (running || !account || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  if (load(account).items.length === 0) return;
  running = true;
  window.dispatchEvent(new Event(SYNCING_EVENT));
  let changed = false;
  try {
    for (;;) {
      const item = load(account).items[0];
      if (!item) break;
      try {
        await send(item);
        remove(item.ref, account);
        changed = true;
      } catch (err) {
        const response = (err as { response?: { status?: number; data?: { message?: string; current?: Appointment } } }).response;
        // fara retea, server care porneste, sesiune expirata: ramane in coada
        if (isNetworkError(err) || !response || (response.status ?? 500) >= 500 || response.status === 401 || response.status === 403) break;
        toConflicts(item, response.data?.message ?? 'Modificarea nu a putut fi salvată.', response.data?.current, account);
        changed = true;
      }
    }
  } finally {
    running = false;
    window.dispatchEvent(new Event(SYNCING_EVENT));
    if (changed) window.dispatchEvent(new Event(SYNCED_EVENT));
  }
}

let started = false;

// O singura data, dupa logare: la revenirea internetului, la pornire si din minut in minut cat timp e ceva in coada
export function startSync(): () => void {
  if (started) return () => undefined;
  started = true;
  const run = () => {
    syncOutbox().catch(() => undefined);
  };
  window.addEventListener('online', run);
  const timer = window.setInterval(run, 60_000);
  run();
  return () => {
    started = false;
    window.removeEventListener('online', run);
    window.clearInterval(timer);
  };
}
