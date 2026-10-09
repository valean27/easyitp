// Coada modificarilor facute fara internet (pe dispozitiv, pe cont). Se trimit in ordine cand revine conexiunea
// (utils/sync.ts); ce nu se poate aplica ajunge in "De rezolvat", cu varianta de acum de pe server.
import type { Appointment } from '../types';

export type OutboxKind = 'create' | 'update' | 'delete' | 'status' | 'itp';

export interface OutboxItem {
  ref: string; // codul unic al modificarii (si clientRef pentru creari / ITP)
  kind: OutboxKind;
  id: number; // programarea (negativ = creata offline, inca nesincronizata)
  version?: number; // versiunea pe care s-a facut schimbarea
  payload?: Record<string, unknown>;
  label: string; // "Ion Pop · 10 oct. 10:00"
  at: string;
}

export interface OutboxConflict {
  item: OutboxItem;
  message: string;
  current?: Appointment;
  at: string;
}

interface Store {
  items: OutboxItem[];
  conflicts: OutboxConflict[];
}

const PREFIX = 'easyitp_outbox:';
export const OUTBOX_EVENT = 'easyitp-outbox';

export function currentAccount(): string | null {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? ((JSON.parse(raw) as { email?: string }).email ?? null) : null;
  } catch {
    return null;
  }
}

export function load(account: string | null = currentAccount()): Store {
  if (!account) return { items: [], conflicts: [] };
  try {
    const raw = localStorage.getItem(PREFIX + account);
    const parsed = raw ? (JSON.parse(raw) as Partial<Store>) : {};
    return { items: parsed.items ?? [], conflicts: parsed.conflicts ?? [] };
  } catch {
    return { items: [], conflicts: [] };
  }
}

function save(account: string, store: Store) {
  try {
    localStorage.setItem(PREFIX + account, JSON.stringify(store));
  } catch {
    /* stocare plina: modificarea ramane doar in pagina */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function newRef(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Adauga o modificare, unind-o cu ce e deja in coada pentru aceeasi programare:
// - o programare creata offline si apoi modificata / stearsa offline: se schimba / dispare crearea insasi;
// - doua modificari offline la aceeasi programare: ramane ultima, pe versiunea de la prima.
export function merge(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  if (item.id < 0) {
    const create = items.find((i) => i.kind === 'create' && i.id === item.id);
    if (create) {
      if (item.kind === 'delete') return items.filter((i) => i !== create);
      if (item.kind === 'update') {
        return items.map((i) => (i === create ? { ...create, payload: { ...create.payload, ...item.payload }, label: item.label } : i));
      }
    }
  }
  if (item.kind === 'update' || item.kind === 'delete' || item.kind === 'status') {
    const earlier = items.find((i) => i.id === item.id && (i.kind === 'update' || i.kind === 'status'));
    if (earlier && item.kind !== 'status' && earlier.kind === 'update') {
      const rest = items.filter((i) => i !== earlier);
      return [...rest, { ...item, version: earlier.version ?? item.version }];
    }
  }
  return [...items, item];
}

export function enqueue(item: OutboxItem, account: string | null = currentAccount()): void {
  if (!account) return;
  const store = load(account);
  save(account, { ...store, items: merge(store.items, item) });
}

export function remove(ref: string, account: string | null = currentAccount()): void {
  if (!account) return;
  const store = load(account);
  save(account, { ...store, items: store.items.filter((i) => i.ref !== ref) });
}

export function toConflicts(item: OutboxItem, message: string, current: Appointment | undefined, account: string | null = currentAccount()): void {
  if (!account) return;
  const store = load(account);
  save(account, {
    items: store.items.filter((i) => i.ref !== item.ref),
    conflicts: [...store.conflicts, { item, message, current, at: new Date().toISOString() }],
  });
}

export function dismissConflict(ref: string, account: string | null = currentAccount()): void {
  if (!account) return;
  const store = load(account);
  save(account, { ...store, conflicts: store.conflicts.filter((c) => c.item.ref !== ref) });
}

// Din "De rezolvat" inapoi in coada: pe versiunea de acum ("aplica varianta mea") sau neschimbata ("incearca din nou")
export function retryConflict(ref: string, version?: number, account: string | null = currentAccount()): void {
  if (!account) return;
  const store = load(account);
  const conflict = store.conflicts.find((c) => c.item.ref === ref);
  if (!conflict) return;
  const item = version === undefined ? conflict.item : { ...conflict.item, version };
  save(account, { items: [...store.items, item], conflicts: store.conflicts.filter((c) => c !== conflict) });
}

// Lista vazuta in pagina: programarile de la server plus ce asteapta in coada (marcate "pending")
export function withPending(list: Appointment[], items: OutboxItem[], day?: string): Appointment[] {
  let out = [...list];
  for (const item of items) {
    if (item.kind === 'create') {
      const a = { ...(item.payload as unknown as Appointment), id: item.id, pending: true };
      if (!day || a.appointmentDate?.startsWith(day)) out.push(a);
    } else if (item.kind === 'update') {
      out = out.map((a) => (a.id === item.id ? { ...a, ...(item.payload as Partial<Appointment>), id: a.id, pending: true } : a));
    } else if (item.kind === 'delete') {
      out = out.filter((a) => a.id !== item.id);
    } else if (item.kind === 'status') {
      out = out.map((a) => (a.id === item.id ? { ...a, status: item.payload?.status as Appointment['status'], pending: true } : a));
    } else if (item.kind === 'itp') {
      out = out.map((a) => (a.id === item.id ? { ...a, status: 'COMPLETED', pending: true } : a));
    }
  }
  return out.sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
}

const KIND_LABELS: Record<OutboxKind, string> = {
  create: 'Programare nouă',
  update: 'Modificare',
  delete: 'Ștergere',
  status: 'Status',
  itp: 'ITP',
};

export const kindLabel = (k: OutboxKind) => KIND_LABELS[k];

// "Ion Pop · 10.10 10:00"
export function apptLabel(a: { clientName?: string | null; appointmentDate?: string | null }): string {
  const when = a.appointmentDate ? `${a.appointmentDate.slice(8, 10)}.${a.appointmentDate.slice(5, 7)} ${a.appointmentDate.slice(11, 16)}` : '';
  return [a.clientName ?? 'Programare', when].filter(Boolean).join(' · ');
}
