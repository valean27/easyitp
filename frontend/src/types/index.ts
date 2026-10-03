export type UserRole = 'ADMIN' | 'MANAGER';

export type ItpStatus = 'PASSED' | 'FAILED' | 'RECHECK';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type ReminderStatus = 'CONTACTED' | 'SCHEDULED' | 'NOT_INTERESTED';

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
  // false = vehiculul are un ITP mai nou
  ultimul: boolean;
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
  appointmentId?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface StationInfo {
  stationName: string | null;
  address: string | null;
  phone: string | null;
}

export interface Profile extends StationInfo {
  email: string;
  role: UserRole;
  reminderTemplate: string | null;
}

export interface Reminder {
  id: number;
  numeSofer: string;
  contact: string | null;
  marca: string;
  model: string | null;
  numarInmatriculare: string;
  dataUrmatorItp: string;
  zileRamase: number;
  reminderStatus: ReminderStatus | null;
  reminderAt: string | null;
}

export interface ManagerSummary extends StationInfo {
  id: number;
  email: string;
  active: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  itpCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  itpThisMonth: number;
  revenueThisMonth: number;
  appointmentsThisMonth: number;
}

export interface Appointment {
  id: number;
  clientName: string;
  phone: string | null;
  licensePlate: string | null;
  appointmentDate: string;
  status: AppointmentStatus;
  itpRecordId?: number | null;
}

export interface ReportMonth {
  month: number;
  count: number;
  revenue: number;
  passed: number;
  failed: number;
  recheck: number;
}

export interface Report {
  year: number;
  availableYears: number[];
  months: ReportMonth[];
  topBrands: { brand: string; count: number }[];
}
