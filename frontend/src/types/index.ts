export type UserRole = 'ADMIN' | 'MANAGER' | 'FLEET' | 'INSPECTOR';

export type ItpStatus = 'PASSED' | 'FAILED' | 'RECHECK';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type ReminderStatus = 'CONTACTED' | 'SCHEDULED' | 'NOT_INTERESTED';

// Acordul clientului pentru remindere (GDPR); null = necunoscut (clientii de dinainte)
export type ReminderConsent = 'GIVEN' | 'DECLINED';

// Alte scadente ale masinii (C4)
export type DeadlineKind = 'RCA' | 'ROVINIETA' | 'TAHOGRAF';
// data (yyyy-mm-dd) pe tip; lipsa = necompletat
export type DeadlineDates = Partial<Record<DeadlineKind, string>>;

// "De contactat" -> Alte scadente
export interface DeadlineReminder {
  vehicleId: number;
  kind: DeadlineKind;
  label: string;
  dueDate: string;
  daysLeft: number;
  clientName: string;
  phone: string | null;
  brand: string;
  model: string | null;
  plate: string;
  consent: ReminderConsent | null;
  stopToken: string | null;
  contactedAt: string | null;
  autoSmsAt: string | null;
}

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
  // RCA / rovinieta / tahograf; lipsa = nu schimba, un tip cu null = sterge
  deadlines?: Partial<Record<DeadlineKind, string | null>>;
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
  // linkurile publice ale statiei (recenzie Google, harta, Facebook)
  reviewUrl: string | null;
  mapsUrl: string | null;
  facebookUrl: string | null;
  // false = adresa de email nu a fost confirmata din linkul primit la inscriere
  emailVerified: boolean;
  // logo-ul statiei (cale publica), null = fara logo
  logoUrl: string | null;
}

// Recenzii si vizibilitate (Contul meu)
export interface Visibility {
  reviewUrl: string | null;
  mapsUrl: string | null;
  facebookUrl: string | null;
  // SMS cu cererea de recenzie in dimineata de dupa ITP
  reviewSms: boolean;
  // nota de pe Google: functia e pornita pe server, locul ales si ultima nota citita
  googleAvailable: boolean;
  googlePlaceId: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
}

// Un loc gasit pe Google (alegerea locului statiei)
export interface GooglePlace {
  id: string;
  name: string | null;
  address: string | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string | null;
}

export type VehicleCategory = 'CAR' | 'FOUR_BY_FOUR' | 'VAN' | 'MOTORCYCLE' | 'TRAILER';

// Tipul vehiculului cu durata inspectiei la statie; "enabled" = se poate programa online
export interface VehicleType {
  category: VehicleCategory;
  label: string;
  minutes: number;
  enabled: boolean;
  // tariful ITP in lei (null = fara); pe pagina publica doar daca statia il arata
  price: number | null;
}

// O zi fara programari online: sarbatoare legala (cu numele ei) sau zi inchisa de statie (cu nota ei)
export interface ClosedDay {
  date: string; // yyyy-mm-dd
  name: string | null;
  holiday: boolean;
}

// Liniile ITP ale statiei: cate sunt si numele lor ("" = "Linia N")
export interface StationLines {
  count: number;
  names: string[];
}

export interface BookingSettings {
  enabled: boolean;
  slug: string | null;
  open: string; // HH:mm:ss
  close: string;
  days: number[]; // 1 = luni ... 7 = duminica
  // numarul liniilor (doar citit aici; se schimba din cardul Linii ITP)
  capacity: number;
  vehicleTypes: VehicleType[];
  // statia apare in lista publica /statii
  publicListing: boolean;
  // numele liniilor, cate unul pe linie ("" = "Linia N")
  lineNames: string[];
  // managerul primeste email la fiecare programare online
  emailNotify: boolean;
  // mesajul statiei pe pagina de programare
  bookingMessage: string | null;
  // pauza zilnica ("HH:mm:ss", ambele sau niciuna)
  breakStart: string | null;
  breakEnd: string | null;
  // fara programari de sarbatorile legale
  holidaysClosed: boolean;
  // tarifele apar pe pagina de programare
  showPrices: boolean;
  // doar citite: zilele inchise de statie de azi incolo si sarbatorile din urmatoarele 12 luni
  closedDays?: ClosedDay[];
  holidays?: ClosedDay[];
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
  mapsUrl: string | null;
  facebookUrl: string | null;
  reviewUrl: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  // logo-ul statiei si mesajul ei pe pagina de programare (pot lipsi)
  logoUrl?: string | null;
  bookingMessage?: string | null;
  // zilele fara programari din perioada in care se poate programa si pauza zilnica
  closedDays?: ClosedDay[];
  breakStart?: string | null;
  breakEnd?: string | null;
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
  // pachetul de SMS inclus in abonament si folosirea lui luna aceasta
  smsPlan: number;
  smsUsedThisMonth: number;
  // abonamentul: pachetul de azi, cel ales (null = cont vechi, Premium fara expirare), ultima zi platita, proba
  plan: 'FREE' | 'PRO' | 'PREMIUM';
  paidPlan: 'FREE' | 'PRO' | 'PREMIUM' | null;
  planUntil: string | null;
  planTrial: boolean;
  // statia a cerut stergerea contului (datele se sterg dupa 30 de zile)
  deletionRequestedAt: string | null;
}

export interface Appointment {
  id: number;
  clientName: string;
  phone: string | null;
  licensePlate: string | null;
  // emailul optional al clientului (confirmarea cu link de calendar)
  email?: string | null;
  appointmentDate: string;
  status: AppointmentStatus;
  itpRecordId?: number | null;
  source?: 'MANUAL' | 'ONLINE' | null;
  vehicleCategory?: VehicleCategory | null;
  // cat ocupa linia; programarile vechi au 30 de minute
  durationMinutes?: number | null;
  // linia ITP (1..numarul de linii); null la salvare = prima libera, la citire = nu mai incape pe nicio linie
  line?: number | null;
  // inspectorul ales anume (null = cel de pe linie) si, doar la citire, cel care lucreaza pe linia programarii
  inspectorId?: number | null;
  lineInspectorId?: number | null;
  // doar citit: tariful statiei pentru tipul vehiculului
  listPrice?: number | null;
  // bifa de acord pentru remindere din programarea online
  reminderConsent?: boolean | null;
  // ce a facut clientul din link-ul din SMS
  clientAction?: 'CANCELLED' | 'RESCHEDULED' | null;
  clientActionAt?: string | null;
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
  // null pe pachetul Gratuit (partea pentru patron e in Pro)
  retention: Retention | null;
  appointments: AppointmentStats | null;
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
  // adresa firmei, pe factura (e-Factura o cere)
  address: string | null;
  city: string | null;
  county: string | null;
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
  deadlines: DeadlineDates;
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
  deadlines?: Partial<Record<DeadlineKind, string | null>>;
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
export type SmsProvider = 'SMS_GATE' | 'SMSLINK' | 'PLATFORM';

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
  // SMS-uri pentru programari: confirmare la programarea online si reminder cu o zi inainte
  apptConfirmSms: boolean;
  apptReminderSms: boolean;
  // Inclus in abonament: contul platformei exista, pachetul statiei (SMS/luna) si cat a folosit luna aceasta
  platformAvailable: boolean;
  smsPlan: number;
  smsUsedThisMonth: number;
  // SMS automat si pentru RCA / rovinieta / tahograf (cu 7 zile inainte)
  deadlinesSms: boolean;
}

// Programarile din anul raportului
export interface AppointmentStats {
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  cancelledByClient: number;
}

export interface AutoSmsLogEntry {
  sentAt: string;
  plate: string | null;
  clientName: string | null;
  stage: number;
  status: 'SENT' | 'FAILED';
  error: string | null;
  attempts: number;
  // null = ITP, altfel RCA / Rovinietă / Tahograf
  kind: string | null;
}

// Cerere de demonstratie din pagina de prezentare (vazuta de admin)
export interface Lead {
  id: number;
  name: string;
  station: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  createdAt: string;
  handled: boolean;
}

// Termenele statiei (D1)
export type StationDeadlineKind = 'AUTORIZATIE_RAR' | 'METROLOGIE' | 'ATESTAT_INSPECTOR' | 'ALTUL';

export interface StationDeadline {
  id: number;
  kind: StationDeadlineKind;
  label: string;
  title: string | null;
  dueDate: string;
  daysLeft: number;
  notes: string | null;
  // expirat sau in fereastra de alerta a tipului
  due: boolean;
}

export interface StationDeadlineInput {
  kind: StationDeadlineKind;
  title: string | null;
  dueDate: string;
  notes: string | null;
}

// Facturare prin Oblio (D3)
export interface InvoicingSettings {
  email: string | null;
  // doar la salvare; serverul nu o trimite inapoi
  secret?: string | null;
  hasSecret: boolean;
  cif: string | null;
  series: string | null;
  vatName: string | null;
  vatPercent: number | null;
  vatIncluded: boolean;
  einvoice: boolean;
  dueDays: number;
  // firma, seria si cota alese: se pot emite facturi
  ready: boolean;
}

export interface InvoicingOptions {
  companies: { cif: string; name: string }[];
  series: string[];
  vatRates: { name: string; percent: number }[];
}

export interface Invoice {
  id: number;
  seriesName: string;
  number: string;
  link: string | null;
  total: number;
  clientName: string | null;
  einvoiceStatus: string | null;
  createdAt: string;
}

// Echipa de inspectori (pagina /inspectori)
export type InspectorColor = 'blue' | 'orange' | 'aqua' | 'yellow' | 'magenta' | 'green' | 'violet' | 'red';

export interface Inspector {
  id: number;
  name: string;
  phone: string | null;
  color: InspectorColor | null;
  active: boolean;
  defaultLine: number | null;
  // din termenele statiei (atestatul inspectorului)
  attestationUntil: string | null;
  attestationDaysLeft: number | null;
  // programul saptamanal (gol = fara program fix) si contul propriu (null = fara cont)
  schedule: InspectorDay[];
  login: string | null;
  // concediile de azi incolo, grupate pe perioade
  leaves: LeaveRange[];
}

export type LeaveKind = 'CONCEDIU' | 'MEDICAL' | 'LIBER';

export interface LeaveRange {
  from: string;
  to: string;
  kind: LeaveKind;
  note: string | null;
}

// O zi de absenta (planificarea lunara)
export interface LeaveDay {
  inspectorId: number;
  date: string;
  kind: LeaveKind;
  note: string | null;
}

// O zi de lucru: 1 = luni ... 7 = duminica; line null = linia lui obisnuita; orele "HH:mm[:ss]" optionale
export interface InspectorDay {
  weekday: number;
  line: number | null;
  start: string | null;
  end: string | null;
}

export interface InspectorRequest {
  name: string;
  phone: string | null;
  color: InspectorColor | null;
  active: boolean;
  defaultLine: number | null;
  attestationUntil: string | null;
  schedule: InspectorDay[];
}

export interface LineShift {
  line: number;
  lineName: string;
  inspectorId: number | null;
  // DAY = ales pentru ziua asta, DEFAULT = linia obisnuita a inspectorului, NONE = nimeni
  source: 'DAY' | 'DEFAULT' | 'NONE';
}

export interface InspectorStats {
  key: string; // "id:<id>", "name:<nume vechi>" sau "none"
  id: number | null;
  name: string;
  color: InspectorColor | null;
  active: boolean;
  itps: number;
  passed: number;
  failed: number;
  recheck: number;
  revenue: number;
  daysWorked: number;
  appointments: number;
  completed: number;
  noShows: number;
  todayLine: number | null;
  todayAppointments: number;
  // are program si azi nu lucreaza
  offToday: boolean;
  leaveToday: LeaveKind | null;
}

export interface InspectorDashboard {
  from: string;
  to: string;
  totals: { itps: number; revenue: number; failed: number; appointments: number; noShows: number; activeInspectors: number };
  inspectors: InspectorStats[];
  days: { date: string; total: number; byInspector: { key: string; count: number }[] }[];
  attestations: Inspector[];
}

// Contul propriu al inspectorului (rol INSPECTOR)
export interface InspectorMe {
  name: string;
  color: InspectorColor | null;
  stationName: string | null;
  stationAddress: string | null;
  stationPhone: string | null;
  lineNames: string[];
  defaultLine: number | null;
  schedule: InspectorDay[];
  itpsThisMonth: number;
  failedThisMonth: number;
  leaves: LeaveRange[];
}

export interface InspectorPortalDay {
  date: string;
  works: boolean;
  line: number | null;
  start: string | null;
  end: string | null;
  leave: LeaveKind | null;
  appointments: Appointment[];
}
