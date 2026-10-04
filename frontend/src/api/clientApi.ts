import api from './axiosInstance';
import { auditEventId } from './historyApi';
import type { ClientDetail, ClientPage, DuplicateGroup, VehicleUpdate } from '../types';

const BASE = '/api/clients';

export const getClients = (q: string, page = 0, size = 30): Promise<ClientPage> =>
  api.get(BASE, { params: { q, page, size } }).then((r) => r.data);

export const getClient = (id: number): Promise<ClientDetail> => api.get(`${BASE}/${id}`).then((r) => r.data);

export const updateClient = (id: number, data: { name: string; phone: string | null }): Promise<ClientDetail> =>
  api.put(`${BASE}/${id}`, data).then((r) => r.data);

// Clientul `id` e aceeasi persoana cu `targetId`: masinile trec la targetId, `id` dispare
export const mergeClient = (id: number, targetId: number): Promise<ClientDetail> =>
  api.post(`${BASE}/${id}/merge`, { clientId: targetId }).then((r) => r.data);

// Intoarce intrarea din istoric (pentru "Anuleaza")
export const deleteClient = (id: number): Promise<number | null> => api.delete(`${BASE}/${id}`).then(auditEventId);

export const getDuplicates = (): Promise<DuplicateGroup[]> => api.get(`${BASE}/duplicates`).then((r) => r.data);

export const updateVehicle = (vehicleId: number, data: VehicleUpdate): Promise<ClientDetail> =>
  api.put(`${BASE}/vehicles/${vehicleId}`, data).then((r) => r.data);

export const moveVehicle = (vehicleId: number, targetClientId: number): Promise<ClientDetail> =>
  api.post(`${BASE}/vehicles/${vehicleId}/move`, { clientId: targetClientId }).then((r) => r.data);

// client null = a ramas fara masini si a fost sters; eventId = intrarea din istoric (pentru "Anuleaza")
export const deleteVehicle = (vehicleId: number): Promise<{ client: ClientDetail | null; eventId: number | null }> =>
  api
    .delete(`${BASE}/vehicles/${vehicleId}`)
    .then((r) => ({ client: r.status === 204 ? null : r.data, eventId: auditEventId(r) }));
