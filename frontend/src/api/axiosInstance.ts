import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('auth_user');
  if (stored) {
    const { token } = JSON.parse(stored) as { token: string };
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
