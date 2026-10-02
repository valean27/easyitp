import api from './axiosInstance';
import type { Profile, StationInfo } from '../types';

const BASE = '/api/account';

export const getProfile = (): Promise<Profile> =>
  api.get(`${BASE}/me`).then((r) => r.data);

export const updateProfile = (data: StationInfo): Promise<Profile> =>
  api.put(`${BASE}/me`, data).then((r) => r.data);

export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  api.put(`${BASE}/password`, { currentPassword, newPassword }).then(() => undefined);
