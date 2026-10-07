import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HardHat, Loader2, AlertTriangle, Plus, Phone, Pencil, ClipboardCheck, Banknote, XCircle, CalendarClock, BadgeAlert, RotateCcw } from 'lucide-react';
import type { Inspector, InspectorDashboard, InspectorStats, LineShift } from '../types';
import { getInspectorDashboard, getInspectorTeam, getLineShifts, setLineShift } from '../api/inspectorApi';
import { getBookingSettings } from '../api/accountApi';
import { usePlan } from '../context/plan';
import { useTheme } from '../context/theme';
import { todayIso } from '../utils/dates';
import { formatDateRo } from '../utils/fleet';
import { formatRon } from '../utils/plans';
import { lineName } from '../utils/lines';
import { PERIOD_LABELS, chartBars, colorHex, failRate, initials, perDay, periodRange, type Period } from '../utils/inspectors';
import { apiMessage } from '../utils/errors';
import PlanLock from './PlanLock';
import DateField from './DateField';
import InspectorModal from './InspectorModal';
import InspectorStackedChart from './InspectorStackedChart';

// Cate serii are graficul; restul intra la "Alții"
const MAX_SERIES = 8;

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4">
      <div className="hidden sm:block p-3 rounded-lg bg-slate-100 text-slate-600">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function Card({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden scroll-mt-20">
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function attestationText(i: Inspector): string {
  const days = i.attestationDaysLeft ?? 0;
  if (days < 0) return `a expirat pe ${formatDateRo(i.attestationUntil)}`;
  if (days === 0) return 'expiră azi';
  return `expiră în ${days} ${days === 1 ? 'zi' : 'zile'} (${formatDateRo(i.attestationUntil)})`;
}

// Pagina /inspectori: dashboard-ul echipei (Pro), cine e azi pe ce linie si lista inspectorilor
export default function InspectorsPage() {
  const { has } = usePlan();
  const { resolved } = useTheme();
  const canDashboard = has('OWNER_REPORTS');
  const [team, setTeam] = useState<Inspector[] | null>(null);
  const [lineNames, setLineNames] = useState<string[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [dashboard, setDashboard] = useState<InspectorDashboard | null>(null);
  // perioada pentru care s-a incarcat dashboard-ul afisat (alta = se incarca)
  const [loadedPeriod, setLoadedPeriod] = useState<Period | null>(null);
  const [shiftDate, setShiftDate] = useState(todayIso);
  const [shifts, setShifts] = useState<LineShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Inspector | 'new' | null>(null);

  const loadTeam = useCallback(() => {
    getInspectorTeam()
      .then(setTeam)
      .catch(() => setError('Inspectorii nu au putut fi încărcați.'));
  }, []);

  const loadDashboard = useCallback(() => {
    if (!canDashboard) return;
    const { from, to } = periodRange(period, todayIso());
    getInspectorDashboard(from, to)
      .then((d) => {
        setDashboard(d);
        setLoadedPeriod(period);
      })
      .catch((err) => setError(apiMessage(err, 'Dashboard-ul nu a putut fi încărcat.')));
  }, [canDashboard, period]);

  useEffect(() => {
    loadTeam();
    getBookingSettings()
      .then((s) => setLineNames(s.lineNames ?? ['']))
      .catch(() => setLineNames(['']));
  }, [loadTeam]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    getLineShifts(shiftDate)
      .then(setShifts)
      .catch(() => setShifts([]));
  }, [shiftDate, team]);

  const changeShift = async (line: number, value: string) => {
    try {
      const next =
        value === 'reset' ? await setLineShift(shiftDate, line, null, true) : await setLineShift(shiftDate, line, value ? Number(value) : null);
      setShifts(next);
      if (shiftDate === todayIso()) loadDashboard();
    } catch (err) {
      setError(apiMessage(err, 'Linia nu a putut fi schimbată.'));
    }
  };

  const afterSave = () => {
    loadTeam();
    loadDashboard();
  };

  // Seriile graficului: inspectorii cu ITP-uri, in ordinea din clasament (culoarea vine de la inspector)
  const rows = useMemo(() => dashboard?.inspectors ?? [], [dashboard]);
  const seriesKeys = useMemo(() => rows.filter((r) => r.itps > 0).slice(0, MAX_SERIES - 1).map((r) => r.key), [rows]);
  const bars = useMemo(() => (dashboard ? chartBars(dashboard.days, seriesKeys) : []), [dashboard, seriesKeys]);
  const colorOf = (key: string) => colorHex(rows.find((r) => r.key === key)?.color ?? null, resolved);
  const nameOf = (key: string) => (key === 'other' ? 'Alții' : (rows.find((r) => r.key === key)?.name ?? key));
  const maxItps = Math.max(1, ...rows.map((r) => r.itps));
  const active = (team ?? []).filter((i) => i.active);
  const inactive = (team ?? []).filter((i) => !i.active);
  const totals = dashboard?.totals;
  const dashLoading = loadedPeriod !== period;
  const hasLines = lineNames.length > 0;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <HardHat size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Inspectori</h1>
              <p className="text-xs text-slate-400 leading-tight">Echipa stației, liniile și cât lucrează fiecare</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canDashboard && (
              <div role="radiogroup" aria-label="Perioada" className="flex flex-wrap rounded-lg border border-slate-200 p-0.5 text-sm">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={period === p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus size={15} /> Inspector
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {team && team.length === 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
            <p className="font-semibold">Adăugați inspectorii stației</p>
            <p className="mt-1">
              Fiecare primește o culoare, linia pe care lucrează de obicei și, opțional, data atestatului. Apoi îi alegeți în formularul ITP și pe
              programări, iar aici vedeți cât a lucrat fiecare.
            </p>
            <button type="button" onClick={() => setEditing('new')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700">
              <Plus size={15} /> Adaugă primul inspector
            </button>
          </div>
        )}

        {/* Dashboard */}
        {!canDashboard ? (
          <PlanLock
            feature="OWNER_REPORTS"
            text="Dashboard-ul inspectorilor (ITP-uri, încasări, rata de respingere, programări și neprezentări pe fiecare om) face parte din pachetul Pro. Echipa și liniile le puteți gestiona și pe Gratuit."
          />
        ) : !dashboard ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Se încarcă...
          </div>
        ) : (
          <div className={`space-y-6 transition-opacity ${dashLoading ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="ITP-uri" value={String(totals!.itps)} sub={PERIOD_LABELS[period]} icon={<ClipboardCheck size={20} />} />
              <Kpi label="Încasări" value={formatRon(Math.round(totals!.revenue))} icon={<Banknote size={20} />} />
              <Kpi
                label="Respinse"
                value={`${failRate(totals!)}%`}
                sub={`${totals!.failed} din ${totals!.itps}`}
                icon={<XCircle size={20} />}
              />
              <Kpi
                label="Programări"
                value={String(totals!.appointments)}
                sub={totals!.noShows ? `${totals!.noShows} neprezentări` : 'fără neprezentări'}
                icon={<CalendarClock size={20} />}
              />
            </div>

            {dashboard.attestations.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <BadgeAlert size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Atestate de reînnoit</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {dashboard.attestations.map((i) => (
                      <li key={i.id}>
                        {i.name}: {attestationText(i)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rows.map((r) => (
                  <InspectorCard key={r.key} stats={r} color={colorOf(r.key)} share={r.itps / maxItps} lineNames={lineNames} />
                ))}
              </div>
            )}

            <Card title={`ITP-uri ${bars.length > 31 ? 'pe luni' : 'pe zile'}, pe inspector`}>
              {totals!.itps === 0 ? (
                <p className="text-sm text-slate-500">Niciun ITP în perioada aleasă.</p>
              ) : (
                <>
                  <InspectorStackedChart bars={bars} colorOf={colorOf} nameOf={nameOf} />
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legenda">
                    {[...seriesKeys, ...(bars.some((b) => b.segments.some((s) => s.key === 'other')) ? ['other'] : [])].map((k) => (
                      <li key={k} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k === 'other' ? colorHex(null, resolved) : colorOf(k) }} />
                        {nameOf(k)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="Detalii pe inspector">
              <div className="overflow-x-auto -mx-4">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-2 font-medium">Inspector</th>
                      <th className="px-3 py-2 font-medium text-right">ITP-uri</th>
                      <th className="px-3 py-2 font-medium text-right">Respinse</th>
                      <th className="px-3 py-2 font-medium text-right">Reverificări</th>
                      <th className="px-3 py-2 font-medium text-right">Încasări</th>
                      <th className="px-3 py-2 font-medium text-right">Zile lucrate</th>
                      <th className="px-3 py-2 font-medium text-right">Pe zi</th>
                      <th className="px-3 py-2 font-medium text-right">Programări</th>
                      <th className="px-4 py-2 font-medium text-right">Neprezentări</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(r.key) }} />
                            {r.name}
                            {r.id !== null && !r.active && <span className="text-xs font-normal text-slate-400">(inactiv)</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.itps}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.failed} <span className="text-slate-400">({failRate(r)}%)</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.recheck}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRon(Math.round(r.revenue))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.daysWorked}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{perDay(r)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.id === null ? '–' : r.appointments}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.id === null ? '–' : r.noShows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                ITP-urile se numără după inspectorul ales în formularul ITP; programările după inspectorul ales pe programare sau cel de pe linia ei
                în ziua aceea.
              </p>
            </Card>
          </div>
        )}

        {/* Cine e pe linii */}
        {hasLines && (
          <Card
            id="linii"
            title="Cine e pe linii"
            action={
              <div className="w-40">
                <DateField value={shiftDate} onChange={(v) => v && setShiftDate(v)} />
              </div>
            }
          >
            {active.length === 0 ? (
              <p className="text-sm text-slate-500">Adăugați întâi inspectorii.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shifts.map((s) => {
                  const who = (team ?? []).find((i) => i.id === s.inspectorId);
                  return (
                    <li key={s.line} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={who?.name ?? '–'} color={who ? colorHex(who.color, resolved) : 'var(--color-slate-300)'} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{lineName(lineNames, s.line)}</p>
                          <p className="text-xs text-slate-500">
                            {s.source === 'DAY' ? 'Ales pentru ziua asta' : s.source === 'DEFAULT' ? 'Linia lui obișnuită' : 'Nimeni pe linie'}
                          </p>
                        </div>
                        {s.source === 'DAY' && (
                          <button
                            type="button"
                            onClick={() => changeShift(s.line, 'reset')}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Înapoi la linia obișnuită"
                            aria-label="Înapoi la linia obișnuită"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                      <select
                        value={s.inspectorId ?? ''}
                        onChange={(e) => changeShift(s.line, e.target.value)}
                        aria-label={`Inspectorul de pe ${lineName(lineNames, s.line)}`}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Nimeni</option>
                        {active.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Fiecare inspector are linia lui obișnuită; aici schimbați doar ziua aleasă (concediu, înlocuire). Liniile se setează în{' '}
              <Link to="/account#programare" className="text-blue-600 hover:underline">
                Contul meu → Programare online
              </Link>
              .
            </p>
          </Card>
        )}

        {/* Echipa */}
        <Card id="echipa" title={team ? `Echipa (${active.length} activi${inactive.length ? `, ${inactive.length} inactivi` : ''})` : 'Echipa'}>
          {!team ? (
            <div className="flex items-center text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
            </div>
          ) : team.length === 0 ? (
            <p className="text-sm text-slate-500">Niciun inspector încă.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...active, ...inactive].map((i) => (
                <li key={i.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${i.active ? '' : 'opacity-60'}`}>
                  <Avatar name={i.name} color={colorHex(i.color, resolved)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {i.name} {!i.active && <span className="text-xs font-normal text-slate-500">· inactiv</span>}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                      {i.defaultLine && <span>{lineName(lineNames, i.defaultLine)}</span>}
                      {i.phone && (
                        <a href={`tel:${i.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                          <Phone size={11} /> {i.phone}
                        </a>
                      )}
                      {i.attestationUntil && (
                        <span className={i.attestationDaysLeft !== null && i.attestationDaysLeft <= 60 ? 'font-medium text-amber-700' : ''}>
                          Atestat până la {formatDateRo(i.attestationUntil)}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(i)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil size={14} /> Editează
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      {editing && (
        <InspectorModal
          inspector={editing === 'new' ? undefined : editing}
          lineNames={lineNames}
          usedColors={(team ?? []).map((i) => i.color)}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}

function InspectorCard({ stats, color, share, lineNames }: { stats: InspectorStats; color: string; share: number; lineNames: string[] }) {
  const isTeam = stats.id !== null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={stats.name} color={color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{stats.name}</p>
          <p className="text-xs text-slate-500">
            {!isTeam
              ? stats.key === 'none'
                ? 'ITP-uri fără inspector ales'
                : 'Nu mai e în echipă'
              : stats.todayLine
                ? `Azi pe ${lineName(lineNames, stats.todayLine)}${stats.todayAppointments ? ` · ${stats.todayAppointments} programări` : ''}`
                : stats.todayAppointments
                  ? `Azi: ${stats.todayAppointments} programări`
                  : stats.active
                    ? 'Azi nu e pe nicio linie'
                    : 'Inactiv'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-slate-800">{stats.itps}</p>
          <p className="text-[11px] text-slate-500">ITP-uri</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100" aria-hidden>
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: color }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-slate-500">Respinse</dt>
          <dd className="text-sm font-semibold tabular-nums text-slate-800">{failRate(stats)}%</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Încasări</dt>
          <dd className="text-sm font-semibold tabular-nums text-slate-800">{formatRon(Math.round(stats.revenue))}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">{isTeam ? 'Programări' : 'Pe zi'}</dt>
          <dd className="text-sm font-semibold tabular-nums text-slate-800">
            {isTeam ? (
              <>
                {stats.appointments}
                {stats.noShows > 0 && <span className="text-xs font-normal text-orange-600"> · {stats.noShows} nepr.</span>}
              </>
            ) : (
              perDay(stats)
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
