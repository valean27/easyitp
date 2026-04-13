export type UserRole = 'ADMIN' | 'MANAGER';

export type ItpStatus = 'PASSED' | 'FAILED' | 'RECHECK';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface DashboardEntry {
  id: number;
  numeSofer: string;
  contact: string;
  marca: string;
  model: string | null;
  year: number | null;
  vin: string;
  numarInmatriculare: string;
  dataItp: string;
  valabilitateLuni: number;
  dataUrmatorItp: string;
  zileRamase: number;
  status: ItpStatus;
  mileage: number | null;
  price: number | null;
  observations: string | null;
}

export interface ItpFormData {
  name: string;
  phone: string;
  brand: string;
  model: string;
  year: number | null;
  vin: string;
  licensePlate: string;
  testDate: string;
  validityMonths: number;
  status: ItpStatus;
  mileage: number | null;
  price: number | null;
  observations: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface Appointment {
  id: number;
  clientName: string;
  phone: string | null;
  licensePlate: string | null;
  appointmentDate: string;
  status: AppointmentStatus;
}
