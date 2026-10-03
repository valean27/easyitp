import { useMemo, useState } from 'react';
import { Search, AlertTriangle, Clock, CheckCircle2, CircleDashed } from 'lucide-react';
import type { FleetVehicle } from '../types';
import { expiryState, formatDateRo, type ExpiryState } from '../utils/fleet';

const STATE_STYLE: Record<ExpiryState, string> = {
  expired: 'text-red-700 bg-red-50 border-red-200',
  soon: 'text-amber-800 bg-amber-50 border-amber-200',
  ok: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  none: 'text-slate-500 bg-slate-50 border-slate-200',
};

function stateText(v: FleetVehicle): string {
  const days = v.daysLeft ?? 0;
  switch (expiryState(v)) {
    case 'expired':
      return days === -1 ? 'Expirat ieri' : `Expirat de ${-days} zile`;
    case 'soon':
      return days === 0 ? 'Expiră azi' : `Expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`;
    case 'ok':
      return `Valabil până la ${formatDateRo(v.nextItpDate)}`;
    default:
      return 'Fără ITP la stație';
  }
}

function StateBadge({ v }: { v: FleetVehicle }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${STATE_STYLE[expiryState(v)]}`}>
      {stateText(v)}
    </span>
  );
}

function Kpi({ label, value, icon, cls }: { label: string; value: number; icon: React.ReactNode; cls: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${cls}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// Masinile unei flote cu scadentele ITP; cele expirate sau aproape de expirare sunt primele
export default function FleetVehicles({ vehicles }: { vehicles: FleetVehicle[] }) {
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c = { expired: 0, soon: 0, ok: 0, none: 0 };
    vehicles.forEach((v) => c[expiryState(v)]++);
    return c;
  }, [vehicles]);

  const q = query.replace(/[\s-]/g, '').toUpperCase();
  const shown = q
    ? vehicles.filter((v) => `${v.plate}${v.brand ?? ''}${v.model ?? ''}`.replace(/[\s-]/g, '').toUpperCase().includes(q))
    : vehicles;

  if (vehicles.length === 0) {
    return <p className="text-sm text-slate-500 bg-white rounded-xl border border-slate-100 p-6 text-center">Nicio mașină alocată încă.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Expirate" value={counts.expired} icon={<AlertTriangle size={16} />} cls="bg-red-50 text-red-600" />
        <Kpi label="Expiră în 30 de zile" value={counts.soon} icon={<Clock size={16} />} cls="bg-amber-50 text-amber-600" />
        <Kpi label="Valabile" value={counts.ok} icon={<CheckCircle2 size={16} />} cls="bg-emerald-50 text-emerald-600" />
        <Kpi label="Fără ITP la stație" value={counts.none} icon={<CircleDashed size={16} />} cls="bg-slate-100 text-slate-500" />
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Caută în ${vehicles.length} mașini (număr, marcă)`}
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Telefon: carduri */}
      <div className="md:hidden space-y-2">
        {shown.map((v) => (
          <div key={v.plate} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-slate-800">{v.plate}</span>
              <StateBadge v={v} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {[v.brand, v.model].filter(Boolean).join(' ') || '—'}
              {v.lastItpDate && ` · ultimul ITP ${formatDateRo(v.lastItpDate)}`}
            </p>
          </div>
        ))}
      </div>

      {/* Ecran mare: tabel */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Nr. înmatriculare</th>
              <th className="text-left font-semibold px-4 py-2.5">Vehicul</th>
              <th className="text-left font-semibold px-4 py-2.5">Ultimul ITP</th>
              <th className="text-left font-semibold px-4 py-2.5">Expiră</th>
              <th className="text-left font-semibold px-4 py-2.5">Stare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((v) => (
              <tr key={v.plate} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{v.plate}</td>
                <td className="px-4 py-2.5 text-slate-600">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{formatDateRo(v.lastItpDate) || '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{formatDateRo(v.nextItpDate) || '—'}</td>
                <td className="px-4 py-2.5"><StateBadge v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Nicio mașină nu se potrivește căutării.</p>}
    </div>
  );
}
