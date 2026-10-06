import api from './axiosInstance';
import type { Lead, ManagerSummary, StationInfo } from '../types';

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

// force = cu toate datele statiei, definitiv (ex. cererea de stergere a statiei, fara cele 30 de zile)
export const deleteManager = (id: number, force = false): Promise<void> =>
  api.delete(`${BASE}/managers/${id}`, { params: force ? { force: true } : undefined }).then(() => undefined);

// Cererile de demonstratie din pagina de prezentare
export const getLeads = (): Promise<Lead[]> => api.get(`${BASE}/leads`).then((r) => r.data);

export const setLeadHandled = (id: number, handled: boolean): Promise<Lead> =>
  api.put(`${BASE}/leads/${id}/handled`, { handled }).then((r) => r.data);

// Abonamentul statiei dat de admin (ex. platit prin transfer): pachetul si ultima zi platita (null = fara expirare)
export const setManagerPlan = (id: number, plan: string, until: string | null): Promise<void> =>
  api.put(`${BASE}/managers/${id}/plan`, { plan, until }).then(() => undefined);

// Pachetul de SMS inclus in abonament al statiei (0 / 300 / 600 / 1000 pe luna)
export const setSmsPlan = (id: number, plan: number): Promise<void> =>
  api.put(`${BASE}/managers/${id}/sms-plan`, { plan }).then(() => undefined);

// Cererile de retragere din contract (functia de retragere de pe site)
export interface Withdrawal {
  id: number;
  name: string;
  email: string;
  contract: string;
  message: string | null;
  userId: number | null;
  createdAt: string;
  handled: boolean;
}

export const getWithdrawals = (): Promise<Withdrawal[]> => api.get(`${BASE}/withdrawals`).then((r) => r.data);

export const setWithdrawalHandled = (id: number, handled: boolean): Promise<Withdrawal> =>
  api.put(`${BASE}/withdrawals/${id}/handled`, { handled }).then((r) => r.data);
