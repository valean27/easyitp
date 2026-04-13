export type UserRole = 'ADMIN' | 'MANAGER';

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
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
