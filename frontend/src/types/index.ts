export type UserRole = 'ADMIN' | 'MANAGER' | 'FLEET';

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
  inspector: string | null;
}

// O pagina din tabelul dashboard-ului (filtrata pe server)
export interface DashboardPage {
  items: DashboardEntry[];
  total: number;
  page: number;
  size: number;
}

// Cardurile din dashboard (pe ultimul ITP al fiecarui vehicul)
export interface DashboardSummary {
  vehicles: number;
  valid: number;
  expiringSoon: number;
  expired: number;
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
  inspector?: string | null;
  appointmentId?: number;
}

export interface ImportResult {
  imported: number;
  // inregistrari existente suprascrise (acelasi numar + aceeasi data ITP)
  updated: number;
  skipped: number;
  errors: string[];
}

// Datele citite de pe talon (campurile necitite sunt null)
export interface RegistrationScan {
  licensePlate: string | null;
  vin: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  ownerName: string | null;
  warnings: string[];
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
  bookingSlug: string | null;
  bookingEnabled: boolean;
  digestEnabled: boolean;
}

export type VehicleCategory = 'CAR' | 'FOUR_BY_FOUR' | 'VAN' | 'MOTORCYCLE' | 'TRAILER';

// Tipul vehiculului cu durata inspectiei la statie; "enabled" = se poate programa online
export interface VehicleType {
  category: VehicleCategory;
  label: string;
  minutes: number;
  enabled: boolean;
}

export interface BookingSettings {
  enabled: boolean;
  slug: string | null;
  open: string; // HH:mm:ss
  close: string;
  days: number[]; // 1 = luni ... 7 = duminica
  capacity: number;
  vehicleTypes: VehicleType[];
}

export interface PublicStation {
  name: string;
  address: string | null;
  phone: string | null;
  open: string;
  close: string;
  days: number[];
  maxDaysAhead: number;
  vehicleTypes: VehicleType[];
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
  source?: 'MANUAL' | 'ONLINE' | null;
  vehicleCategory?: VehicleCategory | null;
  // cat ocupa linia; programarile vechi au 30 de minute
  durationMinutes?: number | null;
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
  // gol pentru admin (vede doar cifre agregate)
  inspectors: InspectorMonth[];
  retention: Retention;
}

export interface InspectorMonth {
  inspector: string; // "Nespecificat" pentru ITP-urile fara inspector
  month: number; // 1-12
  count: number;
  failed: number;
  recheck: number;
  revenue: number;
}

// Vehiculele cu ITP in anul anterior: cate au revenit la scadenta in anul raportului
export interface Retention {
  previousYear: number;
  due: number;
  returned: number;
  notDueYet: number;
  lost: LostClient[];
}

export interface LostClient {
  plate: string;
  name: string;
  phone: string | null;
  lastItpDate: string;
  expiredOn: string;
}

export type DigestChannel = 'EMAIL' | 'WHATSAPP';

export interface DigestSettings {
  enabled: boolean;
  channel: DigestChannel;
  whatsappPhone: string | null;
  // Doar la salvare; serverul nu o trimite niciodata inapoi
  callmebotApiKey?: string;
  hasApiKey: boolean;
}

// ---------- Flote (clienti B2B) ----------

export interface Fleet {
  id: number;
  name: string;
  cui: string | null;
  contactName: string | null;
  contactPhone: string | null;
  plates: string[];
  // contul cu care se logheaza firma; null daca nu are inca
  accountEmail: string | null;
}

export type FleetInput = Omit<Fleet, 'id' | 'accountEmail'>;

export interface FleetSummary {
  id: number;
  name: string;
  cui: string | null;
  contactName: string | null;
  contactPhone: string | null;
  vehicleCount: number;
  expiredCount: number;
  expiringCount: number;
  accountEmail: string | null;
}

// Campurile ITP sunt null pentru masinile care n-au facut inca ITP la statie
export interface FleetVehicle {
  plate: string;
  brand: string | null;
  model: string | null;
  lastItpDate: string | null;
  nextItpDate: string | null;
  daysLeft: number | null;
  status: ItpStatus | null;
}

export interface FleetOverview {
  fleetName: string;
  stationName: string | null;
  stationPhone: string | null;
  stationAddress: string | null;
  bookingSlug: string | null;
  vehicles: FleetVehicle[];
}

export interface StatementRow {
  date: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: ItpStatus;
  validityMonths: number | null;
  price: number | null;
}

export interface FleetStatement {
  fleetName: string;
  cui: string | null;
  stationName: string | null;
  month: string; // yyyy-MM
  rows: StatementRow[];
  total: number;
}
