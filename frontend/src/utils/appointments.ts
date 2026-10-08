import type { Appointment, AppointmentStatus, VehicleCategory } from '../types';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Programat',
  COMPLETED: 'Finalizat',
  CANCELLED: 'Anulat',
  NO_SHOW: 'Neprezentat',
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#94a3b8',
  NO_SHOW: '#f97316',
};

// Etichete scurte pentru calendar
export const VEHICLE_SHORT_LABELS: Record<VehicleCategory, string> = {
  CAR: 'Autoturism',
  FOUR_BY_FOUR: '4x4',
  VAN: 'Autoutilitară',
  MOTORCYCLE: 'Moto',
  TRAILER: 'Remorcă',
};

// Programarile facute inainte de tipurile de vehicul ocupa 30 de minute
export const LEGACY_DURATION_MINUTES = 30;

export function appointmentMinutes(a: Pick<Appointment, 'durationMinutes'>): number {
  return a.durationMinutes ?? LEGACY_DURATION_MINUTES;
}

// Datele pentru formularul de ITP pornit dintr-o programare
export function itpPrefillFromAppointment(a: Appointment, inspectorName?: string) {
  return {
    ...(inspectorName ? { inspector: inspectorName } : {}),
    name: a.clientName,
    phone: a.phone ?? '',
    licensePlate: a.licensePlate ?? '',
    // bifa din programarea online trece in formularul ITP
    ...(a.reminderConsent ? { reminderConsent: true } : {}),
    // tariful statiei pentru tipul vehiculului
    ...(a.listPrice != null ? { price: a.listPrice } : {}),
  };
}
