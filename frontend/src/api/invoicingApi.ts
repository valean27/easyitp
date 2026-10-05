import api from './axiosInstance';
import type { Invoice, InvoicingOptions, InvoicingSettings } from '../types';

const BASE = '/api/invoicing';

export const getInvoicingSettings = (): Promise<InvoicingSettings> => api.get(`${BASE}/settings`).then((r) => r.data);

export const updateInvoicingSettings = (data: InvoicingSettings): Promise<InvoicingSettings> =>
  api.put(`${BASE}/settings`, data).then((r) => r.data);

// Firmele contului Oblio, apoi seriile si cotele de TVA pentru firma aleasa
export const getInvoicingOptions = (cif?: string): Promise<InvoicingOptions> =>
  api.get(`${BASE}/options`, { params: cif ? { cif } : {} }).then((r) => r.data);

export const getFleetInvoice = (fleetId: number, month: string): Promise<Invoice | null> =>
  api.get(`${BASE}/fleets/${fleetId}`, { params: { month } }).then((r) => (r.status === 204 ? null : r.data));

export const issueFleetInvoice = (fleetId: number, month: string): Promise<Invoice> =>
  api.post(`${BASE}/fleets/${fleetId}`, null, { params: { month } }).then((r) => r.data);

export const getItpInvoice = (itpId: number): Promise<Invoice | null> =>
  api.get(`${BASE}/itp/${itpId}`).then((r) => (r.status === 204 ? null : r.data));

export const issueItpInvoice = (itpId: number): Promise<Invoice> => api.post(`${BASE}/itp/${itpId}`).then((r) => r.data);
