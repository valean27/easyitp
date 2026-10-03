import api from './axiosInstance';
import type { Report } from '../types';

const BASE = '/api/reports';

// stationId conteaza doar pentru admin (undefined = toate statiile)
export const getReport = (year: number, stationId?: number): Promise<Report> =>
  api.get(BASE, { params: { year, stationId } }).then((r) => r.data);

export const exportReport = (from: string, to: string, stationId?: number): Promise<void> =>
  api.get(`${BASE}/export`, { params: { from, to, stationId }, responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `raport_itp_${from}_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
