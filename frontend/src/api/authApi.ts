import api from './axiosInstance';

interface AuthResponse {
  token: string;
  email: string;
  role: string;
  stationName: string | null;
}

export interface SignupData {
  stationName: string;
  city: string;
  phone: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  website: string; // capcana pentru boti, ramane goala
}

// 201 cu tokenul contului nou; 202 fara corp = cerere ignorata (bot)
export const signup = (data: SignupData): Promise<AuthResponse | null> =>
  api.post('/api/auth/signup', data).then((r) => (r.status === 201 ? r.data : null));

export const login = (email: string, password: string): Promise<AuthResponse> =>
  api.post('/api/auth/login', { email, password }).then((r) => r.data);

// "Am uitat parola", resetarea din linkul primit pe email si confirmarea adresei; intorc mesajul serverului
export const forgotPassword = (email: string): Promise<string> =>
  api.post('/api/auth/forgot-password', { email }).then((r) => r.data.message);

export const resetPassword = (token: string, password: string): Promise<string> =>
  api.post('/api/auth/reset-password', { token, password }).then((r) => r.data.message);

export const verifyEmail = (token: string): Promise<string> =>
  api.post('/api/auth/verify-email', { token }).then((r) => r.data.message);
