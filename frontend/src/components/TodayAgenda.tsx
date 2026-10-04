import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { getAppointments } from '../api/appointmentApi';
import type { Appointment } from '../types';
import AppointmentModal from './AppointmentModal';
import AddItpModal from './AddItpModal';
import { formatTime, toLocalIso } from '../utils/dates';
import { APPOINTMENT_STATUS_LABELS, itpPrefillFromAppointment } from '../utils/appointments';
import { MONTHS_SHORT, WEEKDAYS_LONG, isoWeekday } from '../utils/booking';

const DAYS_AHEAD = 7;

const STATUS_CLS: Record<Appointment['status'], string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-200 text-slate-500 line-through',
  NO_SHOW: 'bg-orange-100 text-orange-700',
};

type Tab = 'today' | 'tomorrow' | 'week';

function defaultNewTime(): string {
  // Urmatoarea jumatate de ora, intre 08:00 si 18:00
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (d.getHours() < 8) d.setHours(8, 0);
  if (d.getHours() > 18) d.setHours(18, 0);
  return toLocalIso(d).slice(0, 16);
}

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalIso(d).slice(0, 10);
}

// "Azi", "Mâine" sau "Luni, 5 oct"
function dayLabel(day: string, today: string, tomorrow: string): string {
  if (day === today) return 'Azi';
  if (day === tomorrow) return 'Mâine';
  const d = new Date(`${day}T12:00:00`);
  const weekday = WEEKDAYS_LONG[isoWeekday(d) - 1];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Programarile de azi si din zilele urmatoare pe dashboard, cu pornire rapida a ITP-ului pentru azi
export default function TodayAgenda({ onItpSaved }: { onItpSaved: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);

  const today = dayKey(0);
  const tomorrow = dayKey(1);

  const fetchAgenda = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + DAYS_AHEAD + 1);
    try {
      setAppointments(await getAppointments(toLocalIso(start), toLocalIso(end)));
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const byDay = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const day = a.appointmentDate.slice(0, 10);
      // Anularile din zilele urmatoare doar incarca lista
      if (day !== today && a.status === 'CANCELLED') continue;
      groups.set(day, [...(groups.get(day) ?? []), a]);
    }
    return groups;
  }, [appointments, today]);

  const countFor = (day: string) => (byDay.get(day) ?? []).filter((a) => a.status !== 'CANCELLED').length;
  const weekCount = [...byDay.keys()].reduce((sum, day) => sum + countFor(day), 0);
  const todayActive = (byDay.get(today) ?? []).filter((a) => a.status !== 'CANCELLED');
  const todayDone = todayActive.filter((a) => a.status === 'COMPLETED').length;

  const visibleDays =
    tab === 'today' ? [today] : tab === 'tomorrow' ? [tomorrow] : [...byDay.keys()].sort();

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'today', label: 'Azi', count: countFor(today) },
    { key: 'tomorrow', label: 'Mâine', count: countFor(tomorrow) },
    { key: 'week', label: `${DAYS_AHEAD} zile`, count: weekCount },
  ];

  const renderRow = (a: Appointment, isToday: boolean) => (
    <li
      key={a.id}
      onClick={() => setEditAppt(a)}
      className="px-4 sm:px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
    >
      <span className="font-mono text-sm font-semibold text-slate-700 w-12 shrink-0">{formatTime(a.appointmentDate)}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800">{a.clientName}</span>
        {a.licensePlate && <span className="ml-2 font-mono text-xs text-slate-500">{a.licensePlate}</span>}
        {a.source === 'ONLINE' && (
          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-violet-100 text-violet-700">
            Online
          </span>
        )}
        {a.phone && <span className="ml-2 text-xs text-slate-400 hidden sm:inline">{a.phone}</span>}
      </div>
      <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[a.status]}`}>
        {APPOINTMENT_STATUS_LABELS[a.status]}
      </span>
      {a.itpRecordId ? (
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      ) : (
        isToday &&
        a.status !== 'CANCELLED' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItpFor(a);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
          >
            <ClipboardCheck size={13} />
            Începe ITP
          </button>
        )
      )}
    </li>
  );

  const emptyText =
    tab === 'today' ? 'Nicio programare azi.' : tab === 'tomorrow' ? 'Nicio programare mâine.' : `Nicio programare în următoarele ${DAYS_AHEAD} zile.`;
  const hasRows = visibleDays.some((day) => (byDay.get(day) ?? []).length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-600" />
            Programări
            {tab === 'today' && todayActive.length > 0 && (
              <span className="text-sm font-normal text-slate-400">
                ({todayDone} din {todayActive.length} finalizate azi)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus size={14} />
              Programare
            </button>
            <Link to="/calendar" className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Calendar →
            </Link>
          </div>
        </div>
        <div className="flex gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-100' : 'text-slate-400'}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          Se încarcă...
        </div>
      ) : !hasRows ? (
        <p className="px-5 py-5 text-sm text-slate-400">{emptyText}</p>
      ) : tab === 'week' ? (
        <div className="max-h-96 overflow-y-auto">
          {visibleDays.map((day) => (
            <div key={day}>
              <p className="sticky top-0 px-4 sm:px-5 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500 border-y border-slate-100">
                {dayLabel(day, today, tomorrow)} · {countFor(day)} {countFor(day) === 1 ? 'programare' : 'programări'}
              </p>
              <ul className="divide-y divide-slate-50">{(byDay.get(day) ?? []).map((a) => renderRow(a, day === today))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {(byDay.get(visibleDays[0]) ?? []).map((a) => renderRow(a, visibleDays[0] === today))}
        </ul>
      )}

      {creating && (
        <AppointmentModal
          initial={{ appointmentDate: defaultNewTime() }}
          onClose={() => setCreating(false)}
          onSaved={fetchAgenda}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appointment={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={fetchAgenda}
          onDeleted={fetchAgenda}
          onStartItp={setItpFor}
        />
      )}
      {itpFor && (
        <AddItpModal
          prefill={itpPrefillFromAppointment(itpFor)}
          appointmentId={itpFor.id}
          onClose={() => setItpFor(null)}
          onSuccess={() => {
            fetchAgenda();
            onItpSaved();
          }}
        />
      )}
    </div>
  );
}
