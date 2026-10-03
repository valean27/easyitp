import axios from 'axios';
import type { PublicStation } from '../types';

// Instanta separata, fara token si fara redirect la login: pagina publica e folosita de clienti
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

const base = (slug: string) => `/api/public/stations/${encodeURIComponent(slug)}`;

export const getPublicStation = (slug: string): Promise<PublicStation> =>
  publicApi.get(base(slug)).then((r) => r.data);

export const getPublicSlots = (slug: string, date: string): Promise<string[]> =>
  publicApi.get(`${base(slug)}/slots`, { params: { date } }).then((r) => r.data);

export interface PublicBookingData {
  clientName: string;
  phone: string;
  licensePlate: string;
  appointmentDate: string; // yyyy-MM-ddTHH:mm:ss
  website: string; // camp-capcana pentru boti, trebuie sa ramana gol
}

export const createPublicBooking = (slug: string, data: PublicBookingData): Promise<void> =>
  publicApi.post(`${base(slug)}/appointments`, data).then(() => undefined);
