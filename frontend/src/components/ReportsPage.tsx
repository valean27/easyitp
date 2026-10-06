import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Banknote, ClipboardCheck, Calculator, XCircle, Download, Loader2, AlertTriangle } from 'lucide-react';
import type { ManagerSummary, Report } from '../types';
import { getReport, exportReport } from '../api/reportApi';
import { getManagers } from '../api/adminApi';
import { useAuth } from '../context/auth';
import BarChart from './BarChart';
import { AppointmentStatsCard, InspectorRanking, RetentionCard } from './ReportInsights';
import PlanLock from './PlanLock';

const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
const MONTHS_LONG = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

const ron = (v: number) => `${Math.round(v).toLocaleString('ro-RO')} RON`;
const ronAxis = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}k` : String(Math.round(v)));
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');
const pad = (n: number) => String(n).padStart(2, '0');

function lastDayOfMonth(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
}

function Kpi({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4">
      <div className={`hidden sm:block p-3 rounded-lg ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-slate-800 break-words">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
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

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [stationId, setStationId] = useState<number | undefined>(undefined);
  const [stations, setStations] = useState<ManagerSummary[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exporting, setExporting] = useState<'month' | 'year' | null>(null);

  useEffect(() => {
    if (isAdmin) getManagers().then(setStations).catch(() => setStations([]));
  }, [isAdmin]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getReport(year, stationId));
    } catch {
      setError('Raportul nu a putut fi încărcat.');
    } finally {
      setLoading(false);
    }
  }, [year, stationId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (kind: 'month' | 'year') => {
    setExporting(kind);
    try {
      if (kind === 'month') {
        await exportReport(`${year}-${pad(exportMonth)}-01`, lastDayOfMonth(year, exportMonth), stationId);
      } else {
        await exportReport(`${year}-01-01`, `${year}-12-31`, stationId);
      }
    } catch {
      setError('Exportul nu a reușit.');
    } finally {
      setExporting(null);
    }
  };

  const months = report?.months ?? [];
  const totalCount = months.reduce((s, m) => s + m.count, 0);
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalPassed = months.reduce((s, m) => s + m.passed, 0);
  const totalFailed = months.reduce((s, m) => s + m.failed, 0);
  const totalRecheck = months.reduce((s, m) => s + m.recheck, 0);
  const maxBrand = Math.max(1, ...(report?.topBrands ?? []).map((b) => b.count));
  const SELECT_CLS =
    'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Rapoarte</h1>
              <p className="text-xs text-slate-400 leading-tight">
                {isAdmin ? 'Activitatea stațiilor' : 'Activitatea stației'} pe luni
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <select
                value={stationId ?? ''}
                onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : undefined)}
                className={SELECT_CLS}
              >
                <option value="">Toate stațiile</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stationName || s.email}
                  </option>
                ))}
              </select>
            )}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={SELECT_CLS}>
              {(report?.availableYears ?? [year]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {loading && !report ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Se încarcă...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi
                label={`Încasări ${year}`}
                value={ron(totalRevenue)}
                icon={<Banknote size={18} className="text-violet-600" />}
                color="bg-violet-50"
              />
              <Kpi
                label={`ITP-uri ${year}`}
                value={String(totalCount)}
                icon={<ClipboardCheck size={18} className="text-blue-600" />}
                color="bg-blue-50"
              />
              <Kpi
                label="Preț mediu"
                value={totalCount > 0 ? ron(totalRevenue / totalCount) : '—'}
                icon={<Calculator size={18} className="text-slate-600" />}
                color="bg-slate-100"
              />
              <Kpi
                label="Rată respingere"
                value={pct(totalFailed, totalCount)}
                sub={totalCount > 0 ? `${totalFailed} respinse · ${totalRecheck} reverificări · ${pct(totalPassed, totalCount)} admise` : undefined}
                icon={<XCircle size={18} className="text-red-600" />}
                color="bg-red-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Încasări pe lună">
                <BarChart
                  data={months.map((m) => ({
                    label: MONTHS[m.month - 1],
                    value: m.revenue,
                    detail: `${m.count} ITP`,
                  }))}
                  formatValue={ronAxis}
                />
              </Card>
              <Card title="ITP-uri pe lună">
                <BarChart
                  data={months.map((m) => ({
                    label: MONTHS[m.month - 1],
                    value: m.count,
                    detail: m.count > 0 ? `${pct(m.passed, m.count)} promovate` : undefined,
                  }))}
                  formatValue={(v) => String(Math.round(v))}
                />
              </Card>
            </div>

            {/* Pe Gratuit serverul nu trimite partea pentru patron (retention lipseste) */}
            {report && !report.retention && (
              <PlanLock
                feature="OWNER_REPORTS"
                text="Clasamentul inspectorilor, clienții de anul trecut care nu au revenit (cu lista de sunat) și neprezentările la programări fac parte din pachetul Pro."
              />
            )}
            {report?.retention && (
              <div className={`grid grid-cols-1 gap-6 items-start ${isAdmin ? '' : 'lg:grid-cols-2'}`}>
                {!isAdmin && <InspectorRanking key={year} rows={report.inspectors} year={year} />}
                <RetentionCard retention={report.retention} year={year} showList={!isAdmin} />
              </div>
            )}
            {report?.appointments && <AppointmentStatsCard stats={report.appointments} year={year} />}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card title={`Detalii pe luni · ${year}`}>
                  <div className="overflow-x-auto -m-4">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Luna', 'ITP-uri', 'Promovate', 'Respinse', 'Reverificări', 'Rată promovare', 'Încasări'].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {months.map((m) => (
                          <tr key={m.month} className={m.count === 0 ? 'text-slate-300' : 'text-slate-700'}>
                            <td className="px-4 py-2 font-medium">{MONTHS_LONG[m.month - 1]}</td>
                            <td className="px-4 py-2">{m.count}</td>
                            <td className="px-4 py-2">{m.passed}</td>
                            <td className="px-4 py-2">{m.failed}</td>
                            <td className="px-4 py-2">{m.recheck}</td>
                            <td className="px-4 py-2">{pct(m.passed, m.count)}</td>
                            <td className="px-4 py-2 font-medium whitespace-nowrap">{ron(m.revenue)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold text-slate-800">
                          <td className="px-4 py-2.5">Total</td>
                          <td className="px-4 py-2.5">{totalCount}</td>
                          <td className="px-4 py-2.5">{totalPassed}</td>
                          <td className="px-4 py-2.5">{totalFailed}</td>
                          <td className="px-4 py-2.5">{totalRecheck}</td>
                          <td className="px-4 py-2.5">{pct(totalPassed, totalCount)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{ron(totalRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card title="Export pentru contabilitate">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Fișier CSV cu toate ITP-urile din perioadă (dată, număr, client, rezultat, preț) și total. Se deschide
                      direct în Excel.
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={exportMonth}
                        onChange={(e) => setExportMonth(Number(e.target.value))}
                        className={SELECT_CLS + ' flex-1'}
                      >
                        {MONTHS_LONG.map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name} {year}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleExport('month')}
                        disabled={exporting !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                      >
                        {exporting === 'month' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Luna
                      </button>
                    </div>
                    <button
                      onClick={() => handleExport('year')}
                      disabled={exporting !== null}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {exporting === 'year' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Tot anul {year}
                    </button>
                  </div>
                </Card>

                <Card title={`Mărci frecvente · ${year}`}>
                  {(report?.topBrands ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400">Nicio înregistrare în {year}.</p>
                  ) : (
                    <ul className="space-y-2">
                      {report!.topBrands.map((b) => (
                        <li key={b.brand} className="text-sm">
                          <div className="flex justify-between text-slate-700">
                            <span>{b.brand}</span>
                            <span className="text-slate-500">{b.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 mt-1">
                            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${(b.count / maxBrand) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
