import api from './axiosInstance';
import type { DeadlineKind, DeadlineReminder, Reminder, ReminderStatus } from '../types';

const BASE = '/api/reminders';

export const getReminders = (): Promise<Reminder[]> =>
  api.get(BASE).then((r) => r.data);

export const updateReminderStatus = (id: number, status: ReminderStatus | null): Promise<void> =>
  api.put(`${BASE}/${id}`, { status }).then(() => undefined);

// Alte scadente (RCA, rovinieta, tahograf) care expira curand
export const getDeadlineReminders = (): Promise<DeadlineReminder[]> =>
  api.get(`${BASE}/deadlines`).then((r) => r.data);

export const setDeadlineContacted = (vehicleId: number, kind: DeadlineKind, contacted: boolean): Promise<void> =>
  api.put(`${BASE}/deadlines/${vehicleId}/${kind}`, { contacted }).then(() => undefined);
