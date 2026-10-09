import api from './axiosInstance';
import type { Payment } from './billingApi';

// Adminul: facturarea abonamentelor prin FGO si platile tuturor statiilor
const BASE = '/api/admin';

export interface PlatformInvoicing {
  cui: string | null;
  series: string | null;
  test: boolean;
  markPaid: boolean;
  paymentType: string;
  hasKey: boolean;
  // cheia salvata nu se mai poate citi (JWT_SECRET schimbat): trebuie pusa din nou
  keyUnreadable: boolean;
  configured: boolean;
}

export interface PlatformInvoicingRequest {
  cui: string;
  key?: string; // gol = ramane cea salvata
  series: string;
  test: boolean;
  markPaid: boolean;
  paymentType: string;
}

export interface AdminPayment {
  station: string;
  payment: Payment;
  invoiceError: string | null;
}

export const getPlatformInvoicing = (): Promise<PlatformInvoicing> => api.get(`${BASE}/platform-invoicing`).then((r) => r.data);

export const savePlatformInvoicing = (data: PlatformInvoicingRequest): Promise<PlatformInvoicing> =>
  api.put(`${BASE}/platform-invoicing`, data).then((r) => r.data);

export const removePlatformKey = (): Promise<PlatformInvoicing> => api.delete(`${BASE}/platform-invoicing/key`).then((r) => r.data);

export const testPlatformInvoicing = (): Promise<{ message: string }> => api.post(`${BASE}/platform-invoicing/test`).then((r) => r.data);

export const getAdminPayments = (): Promise<AdminPayment[]> => api.get(`${BASE}/payments`).then((r) => r.data);

export const issuePaymentInvoice = (orderId: string): Promise<{ payment: Payment; invoiceError: string | null }> =>
  api.post(`${BASE}/payments/${encodeURIComponent(orderId)}/invoice`).then((r) => r.data);
