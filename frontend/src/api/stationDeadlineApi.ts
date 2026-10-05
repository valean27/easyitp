import api from './axiosInstance';
import type { StationDeadline, StationDeadlineInput } from '../types';

const BASE = '/api/station-deadlines';

export const getStationDeadlines = (): Promise<StationDeadline[]> => api.get(BASE).then((r) => r.data);

export const createStationDeadline = (data: StationDeadlineInput): Promise<StationDeadline> =>
  api.post(BASE, data).then((r) => r.data);

export const updateStationDeadline = (id: number, data: StationDeadlineInput): Promise<StationDeadline> =>
  api.put(`${BASE}/${id}`, data).then((r) => r.data);

export const deleteStationDeadline = (id: number): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined);
