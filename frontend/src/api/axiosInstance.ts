import axios, { type InternalAxiosRequestConfig } from 'axios';
import { isNaturallySlow, requestFinished, requestStarted } from '../utils/serverStatus';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('auth_user');
  if (stored) {
    const { token } = JSON.parse(stored) as { token: string };
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Pentru bannerul "serverul porneste": urmarim cat dureaza cererile obisnuite
  if (!isNaturallySlow(config.url)) {
    (config as TrackedConfig).tracked = true;
    requestStarted();
  }
  return config;
});

type TrackedConfig = InternalAxiosRequestConfig & { tracked?: boolean };

function finish(config: TrackedConfig | undefined) {
  if (config?.tracked) {
    config.tracked = false;
    requestFinished();
  }
}

// Token expirat/invalid -> delogare si redirect la login
api.interceptors.response.use(
  (response) => {
    finish(response.config);
    return response;
  },
  (error) => {
    finish(error.config);
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
