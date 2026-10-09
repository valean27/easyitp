import type { NotificationKind } from '../api/notificationApi';

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  NEW_BOOKING: 'Programare online',
  CLIENT_CANCELLED: 'Anulată de client',
  CLIENT_MOVED: 'Mutată de client',
  INSPECTOR_ITP: 'ITP de la inspector',
  INSPECTOR_NO_SHOW: 'Neprezentat',
  SYNC_CONFLICT: 'Fără internet',
};

// "acum", "acum 5 min", "acum 3 h", "ieri", "12.10"
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return `acum ${hours} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return 'ieri';
  return `${String(then.getDate()).padStart(2, '0')}.${String(then.getMonth() + 1).padStart(2, '0')}`;
}

// Numarul de pe clopotel: peste 99 se scrie "99+"
export function badge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
