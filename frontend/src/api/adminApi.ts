import api from './axiosInstance';
import type { ManagerSummary, StationInfo } from '../types';

const BASE = '/api/admin';

export interface CreateManagerData extends StationInfo {
  email: string;
  password: string;
}

export const createUser = (data: CreateManagerData): Promise<void> =>
  api.post(`${BASE}/create-user`, data).then(() => undefined);

export const getManagers = (): Promise<ManagerSummary[]> =>
  api.get(`${BASE}/managers`).then((r) => r.data);

export const updateManager = (id: number, data: StationInfo): Promise<void> =>
  api.put(`${BASE}/managers/${id}`, data).then(() => undefined);

export const resetManagerPassword = (id: number, password: string): Promise<void> =>
  api.post(`${BASE}/managers/${id}/reset-password`, { password }).then(() => undefined);

export const setManagerActive = (id: number, active: boolean): Promise<void> =>
  api.put(`${BASE}/managers/${id}/active`, { active }).then(() => undefined);

export const deleteManager = (id: number): Promise<void> =>
  api.delete(`${BASE}/managers/${id}`).then(() => undefined);
