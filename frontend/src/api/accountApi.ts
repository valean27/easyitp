import api from './axiosInstance';
import type { AutoSmsLogEntry, AutoSmsSettings, BookingSettings, DigestSettings, Profile, StationInfo, Visibility } from '../types';

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

// Remindere SMS automate
export const getAutoSms = (): Promise<AutoSmsSettings> => api.get(`${BASE}/auto-sms`).then((r) => r.data);

export const updateAutoSms = (data: AutoSmsSettings): Promise<AutoSmsSettings> =>
  api.put(`${BASE}/auto-sms`, data).then((r) => r.data);

// Trimite un SMS de proba; intoarce mesajul de confirmare
export const sendTestSms = (phone: string): Promise<string> =>
  api.post(`${BASE}/auto-sms/test`, { phone }).then((r) => r.data.message);

export const getAutoSmsLog = (): Promise<AutoSmsLogEntry[]> => api.get(`${BASE}/auto-sms/log`).then((r) => r.data);

// Recenzii si vizibilitate: linkurile publice ale statiei si SMS-ul de recenzie
export const getVisibility = (): Promise<Visibility> => api.get(`${BASE}/visibility`).then((r) => r.data);

export const updateVisibility = (data: Visibility): Promise<Visibility> =>
  api.put(`${BASE}/visibility`, data).then((r) => r.data);
