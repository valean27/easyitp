import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { getAppointments } from '../api/appointmentApi';
import type { Appointment } from '../types';
import AppointmentModal from './AppointmentModal';
import AddItpModal from './AddItpModal';
import { formatTime, toLocalIso } from '../utils/dates';
import { APPOINTMENT_STATUS_LABELS, itpPrefillFromAppointment } from '../utils/appointments';

const STATUS_CLS: Record<Appointment['status'], string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-200 text-slate-500 line-through',
};

function defaultNewTime(): string {
  // Urmatoarea jumatate de ora, intre 08:00 si 18:00
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (d.getHours() < 8) d.setHours(8, 0);
  if (d.getHours() > 18) d.setHours(18, 0);
  return toLocalIso(d).slice(0, 16);
}

// Programarile de azi pe dashboard, cu pornire rapida a ITP-ului
export default function TodayAgenda({ onItpSaved }: { onItpSaved: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);

  const fetchToday = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    try {
      setAppointments(await getAppointments(toLocalIso(start), toLocalIso(end)));
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const active = appointments.filter((a) => a.status !== 'CANCELLED');
  const done = active.filter((a) => a.status === 'COMPLETED').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-600" />
          Programări azi
          {active.length > 0 && (
            <span className="text-sm font-normal text-slate-400">
              ({done} din {active.length} finalizate)
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

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          Se încarcă...
        </div>
      ) : appointments.length === 0 ? (
        <p className="px-5 py-5 text-sm text-slate-400">Nicio programare azi.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {appointments.map((a) => (
            <li
              key={a.id}
              onClick={() => setEditAppt(a)}
              className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
            >
              <span className="font-mono text-sm font-semibold text-slate-700 w-12 shrink-0">{formatTime(a.appointmentDate)}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{a.clientName}</span>
                {a.licensePlate && <span className="ml-2 font-mono text-xs text-slate-500">{a.licensePlate}</span>}
                {a.phone && <span className="ml-2 text-xs text-slate-400 hidden sm:inline">{a.phone}</span>}
              </div>
              <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[a.status]}`}>
                {APPOINTMENT_STATUS_LABELS[a.status]}
              </span>
              {a.itpRecordId ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : (
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
          ))}
        </ul>
      )}

      {creating && (
        <AppointmentModal
          initial={{ appointmentDate: defaultNewTime() }}
          onClose={() => setCreating(false)}
          onSaved={fetchToday}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appointment={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={fetchToday}
          onDeleted={fetchToday}
          onStartItp={setItpFor}
        />
      )}
      {itpFor && (
        <AddItpModal
          prefill={itpPrefillFromAppointment(itpFor)}
          appointmentId={itpFor.id}
          onClose={() => setItpFor(null)}
          onSuccess={() => {
            fetchToday();
            onItpSaved();
          }}
        />
      )}
    </div>
  );
}
