import api from './axiosInstance';
import type { Appointment } from '../types';
import { apptLabel, enqueue, newRef } from '../utils/outbox';
import { isNetworkError } from '../utils/offline';

export const getAppointments = (start: string, end: string): Promise<Appointment[]> =>
  api.get('/api/appointments', { params: { start, end } }).then((r) => r.data);

// Programarile care se suprapun cu intervalul [date, date + minutes)
export const getConflicts = (date: string, minutes: number, excludeId?: number): Promise<Appointment[]> =>
  api.get('/api/appointments/conflicts', { params: { date, minutes, excludeId } }).then((r) => r.data);

// Fara internet, crearea / modificarea / stergerea intra in coada (utils/outbox.ts) si se trimit cand revine
// conexiunea; pagina primeste programarea marcata "pending". Programarile cu id negativ sunt create offline.

export async function createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
  try {
    return (await api.post('/api/appointments', data)).data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const ref = newRef();
    const id = -Date.now();
    enqueue({ ref, kind: 'create', id, payload: { ...data, clientRef: ref, offline: true }, label: apptLabel(data), at: new Date().toISOString() });
    return { ...data, id, pending: true } as Appointment;
  }
}

export async function updateAppointment(id: number, data: Partial<Omit<Appointment, 'id'>>): Promise<Appointment> {
  const queue = () => {
    enqueue({ ref: newRef(), kind: 'update', id, version: data.version ?? undefined, payload: { ...data }, label: apptLabel(data), at: new Date().toISOString() });
    return { ...data, id, pending: true } as Appointment;
  };
  if (id < 0) return queue();
  try {
    return (await api.put(`/api/appointments/${id}`, data)).data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return queue();
  }
}

// version: versiunea pe care s-a hotarat stergerea (o programare schimbata intre timp nu se sterge pe nevazute)
export async function deleteAppointment(id: number, version?: number, label = 'Programare'): Promise<void> {
  const queue = () => enqueue({ ref: newRef(), kind: 'delete', id, version, label, at: new Date().toISOString() });
  if (id < 0) return queue();
  try {
    await api.delete(`/api/appointments/${id}`, { params: version != null ? { version } : {} });
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    queue();
  }
}
