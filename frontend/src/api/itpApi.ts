import api from './axiosInstance';
import type { DashboardEntry, ImportResult, ItpFormData } from '../types';

const BASE = '/api/itp';

export const getDashboard = (): Promise<DashboardEntry[]> =>
  api.get(`${BASE}/dashboard`).then((r) => r.data);

export const createItpEntry = (data: ItpFormData): Promise<void> =>
  api.post(BASE, data).then((r) => r.data);

export const deleteItpRecord = (id: number): Promise<void> =>
  api.delete(`${BASE}/${id}`).then(() => undefined);

export const importCsv = (file: File): Promise<ImportResult> => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`${BASE}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const exportCsv = (): Promise<void> =>
  api.get(`${BASE}/export`, { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'itp_export.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
