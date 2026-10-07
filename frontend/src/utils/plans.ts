import { SMS_PLANS } from './smsPlans';

// Pachetele aplicatiei (E1); aceleasi preturi si functii ca Plans.java (pe luna, cu TVA inclus)
export type PlanName = 'FREE' | 'PRO' | 'PREMIUM';

export type Feature =
  | 'AUTO_SMS'
  | 'STATION_DEADLINES'
  | 'OWNER_REPORTS'
  | 'SCAN'
  | 'FLEETS'
  | 'INVOICING'
  | 'REVIEWS';

export const VAT_PERCENT = 21;
export const TRIAL_DAYS = 14;

export const PLAN_LABELS: Record<PlanName, string> = { FREE: 'Gratuit', PRO: 'Pro', PREMIUM: 'Premium' };

export const FEATURE_PLAN: Record<Feature, PlanName> = {
  AUTO_SMS: 'PRO',
  STATION_DEADLINES: 'PRO',
  OWNER_REPORTS: 'PRO',
  SCAN: 'PREMIUM',
  FLEETS: 'PREMIUM',
  INVOICING: 'PREMIUM',
  REVIEWS: 'PREMIUM',
};

export interface PlanInfo {
  name: PlanName;
  price: number;
  tagline: string;
  points: string[];
}

export const PLANS: PlanInfo[] = [
  {
    name: 'FREE',
    price: 0,
    tagline: 'Evidența stației, fără costuri',
    points: [
      'ITP-uri, clienți, istoric cu „Anulează”',
      'Calendar și programare online 24/7',
      'Remindere manuale pe WhatsApp / SMS',
      'Import și export Excel, fișa ITP, afiș cu QR',
      'Rezumatul de dimineață',
    ],
  },
  {
    name: 'PRO',
    price: 59,
    tagline: 'Clienții sunt anunțați singuri',
    points: [
      'Tot ce e în Gratuit',
      'SMS automate de pe telefonul stației (nelimitat)',
      'Confirmare și reminder la programări',
      'Remindere RCA, rovinietă, tahograf',
      'Rapoarte pentru patron, termenele stației',
    ],
  },
  {
    name: 'PREMIUM',
    price: 99,
    tagline: 'Pentru stațiile care lucrează cu firme',
    points: [
      'Tot ce e în Pro',
      'Scanarea talonului cu AI',
      'Flote B2B și facturare Oblio / e-Factura',
      'Cereri de recenzie + nota Google în /statii',
      'Funcțiile premium noi, pe măsură ce apar',
    ],
  },
];

const RANK: Record<PlanName, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

export function includes(plan: PlanName, needed: PlanName): boolean {
  return RANK[plan] >= RANK[needed];
}

export function planPrice(plan: PlanName): number {
  return PLANS.find((p) => p.name === plan)?.price ?? 0;
}

export function smsPrice(sms: number): number {
  return SMS_PLANS.find((p) => p.sms === sms)?.price ?? 0;
}

// Pret pe luna cu TVA (SMS-urile doar peste Pro / Premium)
export function monthlyPrice(plan: PlanName, sms: number): number {
  return plan === 'FREE' ? 0 : planPrice(plan) + smsPrice(sms);
}

// 12 luni la pret de 10
export function billedMonths(months: number): number {
  return months === 12 ? 10 : months;
}

// Suma de plata (preturile includ TVA), la fel ca Plans.amount
export function amountWithVat(plan: PlanName, sms: number, months: number): number {
  return monthlyPrice(plan, sms) * billedMonths(months);
}

// TVA-ul cuprins intr-o suma cu TVA inclus
export function vatIncluded(total: number): number {
  return Math.round((total * VAT_PERCENT * 100) / (100 + VAT_PERCENT)) / 100;
}

export function formatRon(value: number): string {
  return value.toLocaleString('ro-RO', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' RON';
}

// "yyyy-mm-dd" + luni, cu ziua taiata la sfarsitul lunii (ca LocalDate.plusMonths)
function addMonths(iso: string, months: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last)));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface CurrentPlan {
  paidPlan: PlanName;
  planUntil: string | null;
  trial: boolean;
  smsPlan: number;
}

// Ultima zi platita dupa plata, la fel ca BillingService.applyPaid: acelasi pachet se adauga dupa ultima zi platita,
// alt pachet incepe azi (in proba: dupa ultima zi de proba), iar zilele ramase din cel vechi se transforma in zile din cel nou, dupa pret
export function paidUntil(current: CurrentPlan, plan: PlanName, sms: number, months: number, today: string): string {
  if (current.trial && current.planUntil && current.planUntil > today) return isoDay(addMonths(current.planUntil, months));
  const active = current.paidPlan !== 'FREE' && !current.trial && !!current.planUntil && current.planUntil >= today;
  if (!active) return isoDay(addMonths(today, months));
  if (current.paidPlan === plan && current.smsPlan === sms) return isoDay(addMonths(current.planUntil!, months));
  const remaining = Math.round((Date.parse(current.planUntil!) - Date.parse(today)) / 86_400_000);
  const extra = Math.floor((remaining * monthlyPrice(current.paidPlan, current.smsPlan)) / monthlyPrice(plan, sms));
  const end = addMonths(today, months);
  end.setUTCDate(end.getUTCDate() + extra);
  return isoDay(end);
}
