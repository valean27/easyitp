import api from './axiosInstance';
import type { Appointment, AppointmentStatus, InspectorMe, InspectorPortalDay, ItpFormData } from '../types';

// Contul propriu al inspectorului: ziua lui si programarile lui
const BASE = '/api/inspector-portal';

export const getInspectorMe = (): Promise<InspectorMe> => api.get(`${BASE}/me`).then((r) => r.data);

export const getInspectorDay = (date: string): Promise<InspectorPortalDay> => api.get(`${BASE}/day`, { params: { date } }).then((r) => r.data);

export const setMyAppointmentStatus = (id: number, status: AppointmentStatus): Promise<Appointment> =>
  api.put(`${BASE}/appointments/${id}/status`, { status }).then((r) => r.data);

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
}

export const getItpPrefill = (appointmentId: number): Promise<ItpPrefill> =>
  api.get(`${BASE}/appointments/${appointmentId}/prefill`).then((r) => r.data);

// ITP-ul facut la programare: se salveaza pe statie, programarea devine "Finalizat"
export const startMyItp = (appointmentId: number, form: ItpFormData): Promise<Appointment> =>
  api.post(`${BASE}/appointments/${appointmentId}/itp`, form).then((r) => r.data);
