import api from './axiosInstance';

interface AuthResponse {
  token: string;
  email: string;
  role: string;
}

export const login = (email: string, password: string): Promise<AuthResponse> =>
  api.post('/api/auth/login', { email, password }).then((r) => r.data);
