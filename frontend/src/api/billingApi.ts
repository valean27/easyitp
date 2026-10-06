import api from './axiosInstance';
import type { Feature, PlanName } from '../utils/plans';

export interface BillingDetails {
  name: string | null;
  cui: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
}

export interface BillingStatus {
  plan: PlanName; // pachetul de azi
  paidPlan: PlanName; // cel ales (dupa expirare ramane aici, iar plan devine FREE)
  planUntil: string | null;
  trial: boolean;
  daysLeft: number | null;
  smsPlan: number;
  features: Feature[];
  paymentsAvailable: boolean;
  billing: BillingDetails;
}

export interface Payment {
  orderId: string;
  plan: PlanName;
  smsPlan: number;
  months: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  createdAt: string;
  paidAt: string | null;
  planUntil: string | null;
  invoiceNumber: string | null;
  invoiceLink: string | null;
}

export const getBillingStatus = (): Promise<BillingStatus> => api.get('/api/billing/status').then((r) => r.data);

export const updateBillingDetails = (d: BillingDetails): Promise<BillingDetails> =>
  api.put('/api/billing/details', d).then((r) => r.data);

export const startCheckout = (plan: PlanName, smsPlan: number, months: number): Promise<{ orderId: string; paymentUrl: string }> =>
  api.post('/api/billing/checkout', { plan, smsPlan, months }).then((r) => r.data);

export const getPayments = (): Promise<Payment[]> => api.get('/api/billing/payments').then((r) => r.data);

export const refreshPayment = (orderId: string): Promise<Payment> =>
  api.post(`/api/billing/payments/${encodeURIComponent(orderId)}/refresh`).then((r) => r.data);
