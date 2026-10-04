import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { estimateRoi, type RoiInput } from '../../utils/roi';

const FIELDS: { key: keyof RoiInput; label: string; hint: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'itpPerMonth', label: 'ITP-uri pe lună', hint: 'Câte inspecții face stația într-o lună obișnuită', min: 50, max: 2000, step: 10, unit: '' },
  { key: 'avgPrice', label: 'Preț mediu ITP', hint: 'Tariful mediu încasat', min: 80, max: 400, step: 5, unit: 'RON' },
  { key: 'lostPercent', label: 'Clienți care nu revin', hint: 'Câți dintre clienți fac următorul ITP în altă parte', min: 0, max: 80, step: 1, unit: '%' },
  { key: 'recoveredPercent', label: 'Recuperați prin remindere', hint: 'Câți dintre ei revin dacă primesc un SMS la timp', min: 0, max: 60, step: 1, unit: '%' },
];

const ron = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 0 });

// Cat venit aduc clientii recuperati: estimare cu cifrele stației, nu promisiune
export default function RoiCalculator() {
  const [input, setInput] = useState<RoiInput>({ itpPerMonth: 300, avgPrice: 150, lostPercent: 30, recoveredPercent: 20 });
  const result = useMemo(() => estimateRoi(input), [input]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`roi-${f.key}`} className="text-sm font-semibold text-slate-700">{f.label}</label>
              <span className="text-sm font-bold text-blue-600 tabular-nums">
                {ron(input[f.key])} {f.unit}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">{f.hint}</p>
            <input
              id={`roi-${f.key}`}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={input[f.key]}
              onChange={(e) => setInput((i) => ({ ...i, [f.key]: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
          </div>
        ))}
      </div>

      <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 flex flex-col">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#dbeafe]">
          <TrendingUp size={16} /> Venit recuperat estimat
        </div>
        <p className="mt-3 text-4xl font-extrabold tabular-nums">{ron(result.revenuePerYear)} RON</p>
        <p className="text-sm text-[#dbeafe]">pe an · aproximativ {ron(result.revenuePerMonth)} RON pe lună</p>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#dbeafe]">Clienți pe an</dt>
            <dd className="font-semibold tabular-nums">{ron(result.clientsPerYear)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#dbeafe]">Care nu ar reveni</dt>
            <dd className="font-semibold tabular-nums">{ron(result.lostPerYear)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#dbeafe]">Readuși de remindere</dt>
            <dd className="font-semibold tabular-nums">{ron(result.recoveredPerYear)}</dd>
          </div>
        </dl>
        <p className="mt-auto pt-6 text-xs text-[#bfdbfe]">
          Estimare făcută cu cifrele de mai sus, nu o garanție. Mutați cursoarele după situația stației dumneavoastră.
        </p>
      </div>
    </div>
  );
}
