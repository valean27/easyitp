// Link-ul public de programare al statiei (acelasi domeniu ca aplicatia)
export function bookingUrl(slug: string): string {
  return `${window.location.origin}/programare/${slug}`;
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
export const WEEKDAYS_LONG = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
export const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

// Ziua ISO a saptamanii (1 = luni ... 7 = duminica), ca in backend
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}
