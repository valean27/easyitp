import api from './axiosInstance';
import type { BookingSettings, Profile, StationInfo } from '../types';

const BASE = '/api/account';

export const getProfile = (): Promise<Profile> =>
  api.get(`${BASE}/me`).then((r) => r.data);

export const updateProfile = (data: StationInfo & { reminderTemplate: string | null }): Promise<Profile> =>
  api.put(`${BASE}/me`, data).then((r) => r.data);

export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  api.put(`${BASE}/password`, { currentPassword, newPassword }).then(() => undefined);

export const getBookingSettings = (): Promise<BookingSettings> =>
  api.get(`${BASE}/booking`).then((r) => r.data);

export const updateBookingSettings = (data: BookingSettings): Promise<BookingSettings> =>
  api.put(`${BASE}/booking`, data).then((r) => r.data);
