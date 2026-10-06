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
