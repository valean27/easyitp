import type { Appointment, AppointmentStatus } from '../types';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Programat',
  COMPLETED: 'Finalizat',
  CANCELLED: 'Anulat',
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#94a3b8',
};

// Datele pentru formularul de ITP pornit dintr-o programare
export function itpPrefillFromAppointment(a: Appointment) {
  return { name: a.clientName, phone: a.phone ?? '', licensePlate: a.licensePlate ?? '' };
}
