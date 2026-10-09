import api from './axiosInstance';
import type { Appointment, AppointmentStatus, InspectorMe, InspectorPortalDay, ItpFormData } from '../types';
import { apptLabel, enqueue, newRef } from '../utils/outbox';
import { isNetworkError } from '../utils/offline';

// Contul propriu al inspectorului: ziua lui si programarile lui
const BASE = '/api/inspector-portal';

export const getInspectorMe = (): Promise<InspectorMe> => api.get(`${BASE}/me`).then((r) => r.data);

export const getInspectorDay = (date: string): Promise<InspectorPortalDay> => api.get(`${BASE}/day`, { params: { date } }).then((r) => r.data);

// Fara internet statusul intra in coada (utils/outbox.ts), pe versiunea vazuta de inspector
export async function setMyAppointmentStatus(a: Appointment, status: AppointmentStatus): Promise<Appointment> {
  try {
    return (await api.put(`${BASE}/appointments/${a.id}/status`, { status, version: a.version ?? null })).data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueue({ ref: newRef(), kind: 'status', id: a.id, version: a.version, payload: { status }, label: apptLabel(a), at: new Date().toISOString() });
    return { ...a, status, pending: true };
  }
}

// Datele de pornire ale ITP-ului: programarea + masina din ultimul ITP cu acelasi numar
export interface ItpPrefill {
  name: string;
  phone: string | null;
  licensePlate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  validityMonths: number | null;
  reminderConsent: boolean | null;
  // tariful statiei pentru tipul vehiculului din programare
  price: number | null;
}

export const getItpPrefill = (appointmentId: number): Promise<ItpPrefill> =>
  api.get(`${BASE}/appointments/${appointmentId}/prefill`).then((r) => r.data);

// ITP-ul facut la programare: se salveaza pe statie, programarea devine "Finalizat"
// Fara internet ITP-ul intra in coada cu un cod unic: retrimis, serverul nu-l dubleaza
export async function startMyItp(a: Appointment, form: ItpFormData): Promise<Appointment> {
  try {
    return (await api.post(`${BASE}/appointments/${a.id}/itp`, form)).data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const ref = newRef();
    enqueue({ ref, kind: 'itp', id: a.id, payload: { ...form, clientRef: ref }, label: apptLabel(a), at: new Date().toISOString() });
    return { ...a, status: 'COMPLETED', pending: true };
  }
}
