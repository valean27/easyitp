import api from './axiosInstance';

const BASE = '/api/push';

export interface PushStatus {
  available: boolean;
  publicKey: string | null;
  devices: number;
}

export const getPushStatus = (): Promise<PushStatus> => api.get(`${BASE}/status`).then((r) => r.data);

export const savePushSubscription = (sub: PushSubscriptionJSON): Promise<{ devices: number }> =>
  api.post(`${BASE}/subscribe`, { endpoint: sub.endpoint, keys: sub.keys }).then((r) => r.data);

// token: la iesirea din cont tokenul se sterge imediat, asa ca il trimitem explicit
export const removePushSubscription = (endpoint: string, token?: string): Promise<void> =>
  api
    .post(`${BASE}/unsubscribe`, { endpoint }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
    .then(() => undefined);

export const sendTestPush = (): Promise<{ devices: number }> => api.post(`${BASE}/test`).then((r) => r.data);
