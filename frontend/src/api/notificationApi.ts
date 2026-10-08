import api from './axiosInstance';

// Notificarile din aplicatie ale statiei (clopotelul)
export type NotificationKind = 'NEW_BOOKING' | 'CLIENT_CANCELLED' | 'CLIENT_MOVED' | 'INSPECTOR_ITP' | 'INSPECTOR_NO_SHOW';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: AppNotification[];
}

export const getInbox = (): Promise<Inbox> => api.get('/api/notifications').then((r) => r.data);

export const getUnreadCount = (): Promise<number> => api.get('/api/notifications/unread-count').then((r) => r.data.unread);

export const markNotificationRead = (id: number): Promise<void> => api.post(`/api/notifications/${id}/read`).then(() => undefined);

export const markAllNotificationsRead = (): Promise<void> => api.post('/api/notifications/read-all').then(() => undefined);
