import axios from 'axios';

interface AuthResponse {
  token: string;
  email: string;
  role: string;
}

export const login = (email: string, password: string): Promise<AuthResponse> =>
  axios.post('/api/auth/login', { email, password }).then((r) => r.data);
