// Pachetele de SMS incluse in abonament (pe luna, cu TVA inclus); aceleasi valori ca SmsQuotaService.PLANS
export const SMS_PLANS: { sms: number; price: number }[] = [
  { sms: 300, price: 119 },
  { sms: 600, price: 229 },
  { sms: 1000, price: 369 },
];

export function planLabel(sms: number): string {
  if (!sms) return 'Fără pachet';
  const p = SMS_PLANS.find((x) => x.sms === sms);
  return p ? `${sms} SMS · ${p.price} RON` : `${sms} SMS`;
}
