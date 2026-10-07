import api from './axiosInstance';
import type { Inspector, InspectorDashboard, InspectorRequest, LineShift } from '../types';

const BASE = '/api/inspectors';

export const getInspectorTeam = (): Promise<Inspector[]> => api.get(BASE).then((r) => r.data);

export const createInspector = (data: InspectorRequest): Promise<Inspector> => api.post(BASE, data).then((r) => r.data);

export const updateInspector = (id: number, data: InspectorRequest): Promise<Inspector> =>
  api.put(`${BASE}/${id}`, data).then((r) => r.data);

export const deleteInspector = (id: number): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined);

// Cine lucreaza pe fiecare linie in ziua aleasa
export const getLineShifts = (date: string): Promise<LineShift[]> => api.get(`${BASE}/shifts`, { params: { date } }).then((r) => r.data);

// reset = revine la linia obisnuita a inspectorilor; inspectorId null = nimeni pe linie in ziua asta
export const setLineShift = (date: string, line: number, inspectorId: number | null, reset = false): Promise<LineShift[]> =>
  api.put(`${BASE}/shifts`, { date, line, inspectorId, reset }).then((r) => r.data);

export const getInspectorDashboard = (from: string, to: string): Promise<InspectorDashboard> =>
  api.get(`${BASE}/dashboard`, { params: { from, to } }).then((r) => r.data);
