import api from './axiosInstance';
import { auditEventId } from './historyApi';
import type {
  DashboardEntry,
  DashboardPage,
  DashboardSummary,
  DeadlineDates,
  ImportResult,
  ItpFormData,
  RegistrationScan,
} from '../types';

const BASE = '/api/itp';

export interface RecordsQuery {
  page: number;
  size: number;
  q: string;
  onlyLatest: boolean;
}

export const getRecords = (params: RecordsQuery): Promise<DashboardPage> =>
  api.get(`${BASE}/records`, { params }).then((r) => r.data);

export const getSummary = (): Promise<DashboardSummary> => api.get(`${BASE}/summary`).then((r) => r.data);

// Toate ITP-urile unui vehicul, cel mai nou primul
export const getHistory = (plate: string): Promise<DashboardEntry[]> =>
  api.get(`${BASE}/history`, { params: { plate } }).then((r) => r.data);

export const createItpEntry = (data: ItpFormData): Promise<void> =>
  api.post(BASE, data).then((r) => r.data);

// Ultimul ITP pentru un numar (null daca vehiculul nu e cunoscut)
export const lookupByPlate = (plate: string): Promise<DashboardEntry | null> =>
  api.get(`${BASE}/lookup`, { params: { plate } }).then((r) => (r.status === 204 ? null : r.data));

export const updateItpEntry = (id: number, data: ItpFormData): Promise<void> =>
  api.put(`${BASE}/${id}`, data).then(() => undefined);

// Intoarce intrarea din istoric (pentru "Anuleaza")
export const deleteItpRecord = (id: number): Promise<number | null> =>
  api.delete(`${BASE}/${id}`).then(auditEventId);

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

// Poza talonului -> datele vehiculului (poza nu se salveaza pe server)
export const scanRegistration = (image: Blob): Promise<RegistrationScan> => {
  const form = new FormData();
  form.append('image', image, 'talon.jpg');
  return api
    .post(`${BASE}/scan-registration`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000,
    })
    .then((r) => r.data);
};

// RCA / rovinieta / tahograf ale masinii cu acest numar (gol daca nu exista)
export const getDeadlinesForPlate = (plate: string): Promise<DeadlineDates> =>
  api.get(`${BASE}/deadlines`, { params: { plate } }).then((r) => r.data ?? {});
