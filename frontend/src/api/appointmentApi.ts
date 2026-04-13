import api from './axiosInstance';
import type { Appointment } from '../types';

export const getAppointments = (start: string, end: string): Promise<Appointment[]> =>
  api.get('/api/appointments', { params: { start, end } }).then((r) => r.data);

export const createAppointment = (data: Omit<Appointment, 'id'>): Promise<Appointment> =>
  api.post('/api/appointments', data).then((r) => r.data);

export const updateAppointment = (
  id: number,
  data: Partial<Omit<Appointment, 'id'>>
): Promise<Appointment> =>
  api.put(`/api/appointments/${id}`, data).then((r) => r.data);

export const deleteAppointment = (id: number): Promise<void> =>
  api.delete(`/api/appointments/${id}`).then(() => undefined);
