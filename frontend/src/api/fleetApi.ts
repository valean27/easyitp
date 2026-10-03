import api from './axiosInstance';
import type { Fleet, FleetInput, FleetOverview, FleetStatement, FleetSummary } from '../types';

// ---------- managerul statiei ----------

export const getFleets = (): Promise<FleetSummary[]> => api.get('/api/fleets').then((r) => r.data);

export const getFleet = (id: number): Promise<Fleet> => api.get(`/api/fleets/${id}`).then((r) => r.data);

export const createFleet = (data: FleetInput): Promise<Fleet> => api.post('/api/fleets', data).then((r) => r.data);

export const updateFleet = (id: number, data: FleetInput): Promise<Fleet> =>
  api.put(`/api/fleets/${id}`, data).then((r) => r.data);

export const deleteFleet = (id: number): Promise<void> => api.delete(`/api/fleets/${id}`).then(() => undefined);

// Creeaza contul firmei sau ii schimba emailul; parola goala = o pastreaza pe cea veche
export const saveFleetAccount = (id: number, email: string, password: string): Promise<Fleet> =>
  api.put(`/api/fleets/${id}/account`, { email, password }).then((r) => r.data);

export const deleteFleetAccount = (id: number): Promise<Fleet> =>
  api.delete(`/api/fleets/${id}/account`).then((r) => r.data);

export const getFleetOverview = (id: number): Promise<FleetOverview> =>
  api.get(`/api/fleets/${id}/overview`).then((r) => r.data);

export const getFleetStatement = (id: number, month: string): Promise<FleetStatement> =>
  api.get(`/api/fleets/${id}/statement`, { params: { month } }).then((r) => r.data);

// ---------- portalul firmei ----------

export const getMyFleet = (): Promise<FleetOverview> => api.get('/api/fleet-portal').then((r) => r.data);

export const getMyStatement = (month: string): Promise<FleetStatement> =>
  api.get('/api/fleet-portal/statement', { params: { month } }).then((r) => r.data);
