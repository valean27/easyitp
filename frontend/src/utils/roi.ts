// Calculatorul din pagina de prezentare: cat venit aduc clientii recuperati cu remindere.
// Estimare pe baza cifrelor introduse de vizitator, nu o garantie.
export interface RoiInput {
  itpPerMonth: number;
  avgPrice: number;
  // ce procent dintre clienti nu mai revin la statie la urmatorul ITP
  lostPercent: number;
  // ce procent dintre ei revin datorita reminderelor
  recoveredPercent: number;
}

export interface RoiResult {
  clientsPerYear: number;
  lostPerYear: number;
  recoveredPerYear: number;
  revenuePerYear: number;
  revenuePerMonth: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));

export function estimateRoi(input: RoiInput): RoiResult {
  const itp = clamp(input.itpPerMonth, 0, 100_000);
  const price = clamp(input.avgPrice, 0, 10_000);
  const lost = clamp(input.lostPercent, 0, 100) / 100;
  const recovered = clamp(input.recoveredPercent, 0, 100) / 100;
  const clientsPerYear = Math.round(itp * 12);
  const lostPerYear = Math.round(clientsPerYear * lost);
  const recoveredPerYear = Math.round(lostPerYear * recovered);
  const revenuePerYear = recoveredPerYear * price;
  return { clientsPerYear, lostPerYear, recoveredPerYear, revenuePerYear, revenuePerMonth: Math.round(revenuePerYear / 12) };
}
