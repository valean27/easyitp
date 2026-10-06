import { SMS_PLANS } from './smsPlans';

// Pachetele aplicatiei (E1); aceleasi preturi si functii ca Plans.java (pe luna, fara TVA)
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

// Pret pe luna fara TVA (SMS-urile doar peste Pro / Premium)
export function monthlyPrice(plan: PlanName, sms: number): number {
  return plan === 'FREE' ? 0 : planPrice(plan) + smsPrice(sms);
}

// 12 luni la pret de 10
export function billedMonths(months: number): number {
  return months === 12 ? 10 : months;
}

// Suma de plata cu TVA, la fel ca Plans.amount
export function amountWithVat(plan: PlanName, sms: number, months: number): number {
  const net = monthlyPrice(plan, sms) * billedMonths(months);
  return Math.round(net * (100 + VAT_PERCENT)) / 100;
}

export function formatRon(value: number): string {
  return value.toLocaleString('ro-RO', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' RON';
}
