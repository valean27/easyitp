export type UserRole = 'ADMIN' | 'MANAGER' | 'FLEET';

export type ItpStatus = 'PASSED' | 'FAILED' | 'RECHECK';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type ReminderStatus = 'CONTACTED' | 'SCHEDULED' | 'NOT_INTERESTED';

// Acordul clientului pentru remindere (GDPR); null = necunoscut (clientii de dinainte)
export type ReminderConsent = 'GIVEN' | 'DECLINED';

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
  reminderConsent: ReminderConsent | null;
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
  // bifa "clientul e de acord cu remindere"; lipsa = nu schimba acordul
  reminderConsent?: boolean;
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
  consent: ReminderConsent | null;
  // pentru link-ul de dezabonare din mesaj (/stop/{token})
  stopToken: string;
  // cand a plecat ultimul SMS automat pentru acest ITP
  autoSmsAt: string | null;
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
  // bifa de acord pentru remindere din programarea online
  reminderConsent?: boolean | null;
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

// ---------- Clienti (pagina "Clienti") ----------

export interface ClientSummary {
  id: number;
  name: string;
  phone: string | null;
  vehicleCount: number;
  plates: string[];
  // cea mai apropiata scadenta dintre masinile clientului
  nextItpDate: string | null;
  daysLeft: number | null;
}

export interface ClientPage {
  items: ClientSummary[];
  total: number;
  page: number;
  size: number;
}

export interface VehicleItp {
  id: number;
  testDate: string;
  validityMonths: number;
  nextItpDate: string;
  status: ItpStatus;
  mileage: number | null;
  price: number | null;
  inspector: string | null;
}

export interface ClientVehicle {
  id: number;
  licensePlate: string;
  brand: string;
  model: string | null;
  year: number | null;
  vin: string | null;
  // cel mai nou primul
  itps: VehicleItp[];
}

export interface ClientDetail {
  id: number;
  name: string;
  phone: string | null;
  consent: ReminderConsent | null;
  consentAt: string | null;
  consentSource: string | null;
  vehicles: ClientVehicle[];
}

export interface VehicleUpdate {
  licensePlate: string;
  brand: string;
  model: string | null;
  year: number | null;
  vin: string | null;
}

export interface ClientBrief {
  id: number;
  name: string;
  phone: string | null;
  vehicleCount: number;
}

export interface DuplicateGroup {
  reason: string;
  clients: ClientBrief[];
}

// ---------- Istoric modificari ----------

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'MERGE' | 'MOVE' | 'IMPORT';
export type AuditEntityType = 'ITP' | 'CLIENT' | 'VEHICLE';

export interface HistoryEvent {
  id: number;
  createdAt: string;
  actor: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  summary: string;
  // campurile schimbate, cate unul pe linie ("Preț: 150,00 → 200,00")
  changes: string | null;
  canUndo: boolean;
  restoredAt: string | null;
}

export interface HistoryPage {
  items: HistoryEvent[];
  total: number;
  page: number;
  size: number;
}

// ---------- Remindere SMS automate ----------

// SMS_GATE = telefonul statiei (aplicatia SMS Gateway for Android), SMSLINK = gateway SMSLink.ro
export type SmsProvider = 'SMS_GATE' | 'SMSLINK';

export interface AutoSmsSettings {
  enabled: boolean;
  provider: SmsProvider | null;
  // cu cate zile inainte de expirare (descrescator)
  days: number[];
  template: string;
  defaultTemplate: string;
  smsGateUrl: string | null;
  smsGateUsername: string | null;
  // parolele sunt doar de scris: gol = se pastreaza cea salvata
  smsGatePassword?: string | null;
  hasSmsGatePassword: boolean;
  smslinkConnectionId: string | null;
  smslinkPassword?: string | null;
  hasSmslinkPassword: boolean;
  sentLast30Days: number;
}

export interface AutoSmsLogEntry {
  sentAt: string;
  plate: string | null;
  clientName: string | null;
  stage: number;
  status: 'SENT' | 'FAILED';
  error: string | null;
  attempts: number;
}
