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

// Token expirat/invalid -> delogare si redirect la login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.includes('/api/auth/');
    if (error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('auth_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
