import type { AxiosResponse } from 'axios';
import api from './axiosInstance';
import type { HistoryPage } from '../types';

const BASE = '/api/history';

export type HistoryFilter = 'all' | 'deletes' | 'changes' | 'adds';

export const getHistory = (filter: HistoryFilter, page = 0, size = 50): Promise<HistoryPage> =>
  api.get(BASE, { params: { filter, page, size } }).then((r) => r.data);

// Pune la loc datele sterse; intoarce mesajul serverului ("A fost restaurat 1 ITP.")
export const undoEvent = (eventId: number): Promise<string> =>
  api.post(`${BASE}/${eventId}/undo`).then((r) => r.data.message);

// Dupa o stergere serverul trimite id-ul intrarii din istoric in antetul X-Audit-Event
export function auditEventId(response: AxiosResponse): number | null {
  const raw = response.headers['x-audit-event'];
  const id = Number(raw);
  return raw && Number.isFinite(id) ? id : null;
}
