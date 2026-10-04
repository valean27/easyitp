import axios from 'axios';
import type { PublicStation, VehicleCategory } from '../types';

// Instanta separata, fara token si fara redirect la login: pagina publica e folosita de clienti
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

// Link-ul STOP din mesaje: statia de la care vine mesajul si daca clientul s-a dezabonat deja
export interface StopInfo {
  stationName: string | null;
  stopped: boolean;
}

export const getStopInfo = (token: string): Promise<StopInfo> =>
  publicApi.get(`/api/public/stop/${encodeURIComponent(token)}`).then((r) => r.data);

export const confirmStop = (token: string): Promise<StopInfo> =>
  publicApi.post(`/api/public/stop/${encodeURIComponent(token)}`).then((r) => r.data);

// O statie din lista publica /statii
export interface PublicStationSummary {
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  open: string; // HH:mm:ss
  close: string;
  days: number[];
}

export const getPublicStations = (): Promise<PublicStationSummary[]> =>
  publicApi.get('/api/public/stations').then((r) => r.data);

const base = (slug: string) => `/api/public/stations/${encodeURIComponent(slug)}`;

export const getPublicStation = (slug: string): Promise<PublicStation> =>
  publicApi.get(base(slug)).then((r) => r.data);

export const getPublicSlots = (slug: string, date: string, category: VehicleCategory): Promise<string[]> =>
  publicApi.get(`${base(slug)}/slots`, { params: { date, category } }).then((r) => r.data);

export interface PublicBookingData {
  clientName: string;
  phone: string;
  licensePlate: string;
  appointmentDate: string; // yyyy-MM-ddTHH:mm:ss
  vehicleCategory: VehicleCategory;
  // clientul vrea remindere de la statie (bifa optionala)
  reminderConsent: boolean;
  website: string; // camp-capcana pentru boti, trebuie sa ramana gol
}

// Intoarce token-ul link-ului de anulare / mutare (/p/{token})
export const createPublicBooking = (slug: string, data: PublicBookingData): Promise<string | null> =>
  publicApi.post(`${base(slug)}/appointments`, data).then((r) => r.data?.manageToken ?? null);

// Link-ul clientului din SMS: programarea, anulare, mutare
export interface ManagedAppointment {
  stationName: string;
  address: string | null;
  phone: string | null;
  slug: string | null;
  appointmentDate: string;
  licensePlate: string | null;
  vehicleLabel: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  canChange: boolean;
  clientAction: string | null;
}

const mine = (token: string) => `/api/public/appointments/${encodeURIComponent(token)}`;

export const getMyAppointment = (token: string): Promise<ManagedAppointment> => publicApi.get(mine(token)).then((r) => r.data);

export const cancelMyAppointment = (token: string): Promise<ManagedAppointment> =>
  publicApi.post(`${mine(token)}/cancel`).then((r) => r.data);

export const getMyAppointmentSlots = (token: string, date: string): Promise<string[]> =>
  publicApi.get(`${mine(token)}/slots`, { params: { date } }).then((r) => r.data);

export const rescheduleMyAppointment = (token: string, appointmentDate: string): Promise<ManagedAppointment> =>
  publicApi.post(`${mine(token)}/reschedule`, { appointmentDate }).then((r) => r.data);

// Cererea de demonstratie din pagina de prezentare
export interface LeadData {
  name: string;
  station: string;
  city: string;
  phone: string;
  email: string;
  message: string;
  website: string; // camp-capcana pentru boti, trebuie sa ramana gol
}

export const submitLead = (data: LeadData): Promise<void> =>
  publicApi.post('/api/public/leads', data).then(() => undefined);
