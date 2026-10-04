import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Phone, UserX } from 'lucide-react';
import type { InspectorMonth, Retention, AppointmentStats } from '../types';
import { UNKNOWN_INSPECTOR, inspectorTotals, monthsWithData } from '../utils/reportStats';
import { formatDateRo } from '../utils/fleet';

const MONTHS_LONG = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');
const ron = (v: number) => `${Math.round(v).toLocaleString('ro-RO')} RON`;

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// "Care inspector a facut cele mai multe verificari?" - pe luna aleasa sau pe tot anul
export function InspectorRanking({ rows, year }: { rows: InspectorMonth[]; year: number }) {
  const months = monthsWithData(rows);
  const now = new Date();
  // Implicit luna curenta, daca anul raportului e anul curent si are date; altfel tot anul
  const [month, setMonth] = useState<number | null>(() =>
    year === now.getFullYear() && months.includes(now.getMonth() + 1) ? now.getMonth() + 1 : null
  );
  const totals = useMemo(() => inspectorTotals(rows, month), [rows, month]);
  const max = Math.max(1, ...totals.map((t) => t.count));
  const onlyUnknown = totals.length > 0 && totals.every((t) => t.inspector === UNKNOWN_INSPECTOR);

  return (
    <Card
      title="Clasament inspectori"
      action={
        <select
          value={month ?? ''}
          onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tot anul {year}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {MONTHS_LONG[m - 1]} {year}
            </option>
          ))}
        </select>
      }
    >
      {totals.length === 0 ? (
        <p className="text-sm text-slate-400">Nicio verificare în perioada aleasă.</p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {totals.map((t, i) => {
              const unknown = t.inspector === UNKNOWN_INSPECTOR;
              return (
                <li key={t.inspector} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1.5 font-medium ${unknown ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                      {i === 0 && !unknown && <Trophy size={14} className="text-amber-500" />}
                      {t.inspector}
                    </span>
                    <span className="text-slate-800 font-semibold">{t.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1">
                    <div
                      className={`h-1.5 rounded-full ${unknown ? 'bg-slate-300' : 'bg-blue-600'}`}
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t.failed} respinse ({pct(t.failed, t.count)}) · {t.recheck} reverificări · {ron(t.revenue)}
                  </p>
                </li>
              );
            })}
          </ul>
          {onlyUnknown && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Adaugă inspectorii în <Link to="/account" className="text-blue-600 font-medium">Contul meu</Link> și alege-l
              pe cel care face verificarea în formularul ITP. ITP-urile vechi rămân „Nespecificat”.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// "Cati clienti de anul trecut nu s-au mai intors anul acesta?"
export function RetentionCard({ retention, year, showList }: { retention: Retention; year: number; showList: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { due, returned, notDueYet, previousYear, lost } = retention;
  const lostCount = due - returned;
  const shown = expanded ? lost : lost.slice(0, 6);

  return (
    <Card title={`Clienți ${previousYear} care au revenit în ${year}`}>
      {due === 0 && notDueYet === 0 ? (
        <p className="text-sm text-slate-400">Niciun ITP în {previousYear} la această stație.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-50 px-2 py-2.5">
              <p className="text-xl font-bold text-emerald-700">{pct(returned, due)}</p>
              <p className="text-xs text-emerald-800">au revenit ({returned}/{due})</p>
            </div>
            <div className="rounded-lg bg-red-50 px-2 py-2.5">
              <p className="text-xl font-bold text-red-700">{lostCount}</p>
              <p className="text-xs text-red-800">nu au mai venit</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-2.5">
              <p className="text-xl font-bold text-slate-700">{notDueYet}</p>
              <p className="text-xs text-slate-500">ITP încă valabil</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Vehicule cu ITP la stație în {previousYear}. Le numărăm doar pe cele care au ajuns la scadență, așa că un ITP
            valabil 2 ani nu apare drept client pierdut.
          </p>

          {showList && lost.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <UserX size={13} /> De recuperat (cei pierduți recent primii)
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {shown.map((c) => (
                  <li key={c.plate} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        <span className="font-mono">{c.plate}</span> · {c.name}
                      </p>
                      <p className="text-xs text-slate-400">ITP expirat pe {formatDateRo(c.expiredOn)}</p>
                    </div>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 shrink-0">
                        <Phone size={12} /> Sună
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {lost.length > 6 && (
                <button onClick={() => setExpanded((e) => !e)} className="mt-2 text-xs font-medium text-blue-600">
                  {expanded ? 'Arată mai puțini' : `Arată toți (${lost.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Programarile anului: cate s-au finalizat, cati clienti nu au venit, cate au fost anulate
export function AppointmentStatsCard({ stats, year }: { stats: AppointmentStats; year: number }) {
  // doar programarile incheiate (au venit sau nu); cele viitoare inca nu conteaza
  const concluded = stats.completed + stats.noShow;
  const rate = concluded > 0 ? Math.round((stats.noShow / concluded) * 100) : 0;
  const cell = (value: number, label: string, cls: string) => (
    <div className={`rounded-xl px-3 py-3 text-center ${cls}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-800">Programări {year}</h3>
        <span className="text-xs text-slate-400">{stats.total} în total</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cell(stats.completed, 'au venit', 'bg-emerald-50 text-emerald-700')}
          {cell(stats.noShow, 'neprezentați', 'bg-orange-50 text-orange-700')}
          {cell(stats.cancelled, 'anulate', 'bg-slate-50 text-slate-600')}
          {cell(stats.cancelledByClient, 'anulate de client', 'bg-slate-50 text-slate-600')}
        </div>
        <p className="text-xs text-slate-500">
          {concluded === 0
            ? 'Rata de neprezentare apare după primele programări încheiate.'
            : `Rată de neprezentare: ${rate}%. Confirmarea și reminderul prin SMS (Contul meu) îi fac pe clienți să anunțe din timp.`}
        </p>
      </div>
    </div>
  );
}
