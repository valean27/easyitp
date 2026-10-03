import api from './axiosInstance';
import type { BookingSettings, DigestSettings, Profile, StationInfo } from '../types';

const BASE = '/api/account';

export const getProfile = (): Promise<Profile> =>
  api.get(`${BASE}/me`).then((r) => r.data);

export const updateProfile = (data: StationInfo & { reminderTemplate: string | null }): Promise<Profile> =>
  api.put(`${BASE}/me`, data).then((r) => r.data);

// Raspunde cu un token nou: celelalte sesiuni (alte dispozitive) sunt delogate
export const changePassword = (currentPassword: string, newPassword: string): Promise<string> =>
  api.put(`${BASE}/password`, { currentPassword, newPassword }).then((r) => r.data.token);

// Inspectorii statiei (doar nume), aleși în formularul ITP
export const getInspectors = (): Promise<string[]> => api.get(`${BASE}/inspectors`).then((r) => r.data);

export const updateInspectors = (names: string[]): Promise<string[]> =>
  api.put(`${BASE}/inspectors`, names).then((r) => r.data);

export const getBookingSettings = (): Promise<BookingSettings> =>
  api.get(`${BASE}/booking`).then((r) => r.data);

export const updateBookingSettings = (data: BookingSettings): Promise<BookingSettings> =>
  api.put(`${BASE}/booking`, data).then((r) => r.data);

export const getDigestSettings = (): Promise<DigestSettings> =>
  api.get(`${BASE}/digest`).then((r) => r.data);

export const updateDigestSettings = (data: DigestSettings): Promise<DigestSettings> =>
  api.put(`${BASE}/digest`, data).then((r) => r.data);

// Trimite acum emailul zilnic catre utilizatorul logat; la eroare, mesajul vine de la server
export const sendTestDigest = (): Promise<string> =>
  api.post(`${BASE}/digest/test`).then((r) => r.data.message);
