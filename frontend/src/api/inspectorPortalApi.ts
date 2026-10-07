import api from './axiosInstance';
import type { Appointment, AppointmentStatus, InspectorMe, InspectorPortalDay } from '../types';

// Contul propriu al inspectorului: ziua lui si programarile lui
const BASE = '/api/inspector-portal';

export const getInspectorMe = (): Promise<InspectorMe> => api.get(`${BASE}/me`).then((r) => r.data);

export const getInspectorDay = (date: string): Promise<InspectorPortalDay> => api.get(`${BASE}/day`, { params: { date } }).then((r) => r.data);

export const setMyAppointmentStatus = (id: number, status: AppointmentStatus): Promise<Appointment> =>
  api.put(`${BASE}/appointments/${id}/status`, { status }).then((r) => r.data);
