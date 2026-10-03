import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventCalendar } from '@mui/x-scheduler/event-calendar';
import { roRO } from '@mui/x-scheduler/locales';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ro } from 'date-fns/locale';
import { Loader2, AlertTriangle } from 'lucide-react';
import { getAppointments, updateAppointment } from '../api/appointmentApi';
import type { Appointment, AppointmentStatus } from '../types';
import AppointmentModal from './AppointmentModal';
import AddItpModal from './AddItpModal';
import { toLocalIso } from '../utils/dates';
import { itpPrefillFromAppointment } from '../utils/appointments';

const SLOT_MINUTES = 30;

// Campurile folosite din modelul de eveniment al calendarului MUI (SchedulerEvent)
type SchedulerEventColor = 'red' | 'pink' | 'purple' | 'indigo' | 'blue' | 'teal' | 'green' | 'lime' | 'amber' | 'orange' | 'grey';
interface SchedulerEvent {
  id: number;
  title: string;
  description?: string;
  start: string; // ora locala, fara "Z"
  end: string;
  color?: SchedulerEventColor;
  draggable?: boolean;
}

const STATUS_COLOR: Record<AppointmentStatus, SchedulerEventColor> = {
  SCHEDULED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'grey',
};

// Tema MUI aliniata cu restul aplicatiei (Tailwind): fontul paginii si albastrul principal
const theme = createTheme({
  typography: { fontFamily: 'inherit' },
  palette: { primary: { main: '#2563eb' } },
  shape: { borderRadius: 10 },
  components: { MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } } },
});

function addMinutes(iso: string, minutes: number): string {
  return toLocalIso(new Date(new Date(iso).getTime() + minutes * 60_000));
}

// Intervalul incarcat: luna vizibila plus o saptamana la capete (acopera si vederea pe luna)
function rangeAround(date: Date): { start: Date; end: Date; key: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setDate(start.getDate() - 7);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  end.setDate(end.getDate() + 7);
  return { start, end, key: `${date.getFullYear()}-${date.getMonth()}` };
}

function toEvent(a: Appointment): SchedulerEvent {
  const start = a.appointmentDate.slice(0, 19);
  return {
    id: a.id,
    title: `${a.itpRecordId ? '✓ ' : ''}${a.source === 'ONLINE' ? '🌐 ' : ''}${a.clientName}${a.licensePlate ? ' · ' + a.licensePlate : ''}`,
    description: [a.phone, a.status === 'CANCELLED' ? 'Anulat' : null].filter(Boolean).join(' · ') || undefined,
    start,
    end: addMinutes(start, SLOT_MINUTES),
    color: a.source === 'ONLINE' && a.status === 'SCHEDULED' ? 'purple' : STATUS_COLOR[a.status],
    // Programarile finalizate sau anulate nu se mai muta
    draggable: a.status === 'SCHEDULED',
  };
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(() => rangeAround(new Date()));
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);

  const fetchRange = useCallback(async () => {
    setLoading(true);
    try {
      setAppointments(await getAppointments(toLocalIso(range.start), toLocalIso(range.end)));
    } catch {
      setError('Programările nu au putut fi încărcate.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchRange();
  }, [fetchRange]);

  const events = useMemo(() => appointments.map(toEvent), [appointments]);

  const handleSaved = (saved: Appointment) =>
    setAppointments((prev) =>
      prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]
    );

  // Drag & drop: mutam programarea la noua ora (durata ramane 30 min)
  const handleEventsChange = async (next: SchedulerEvent[]) => {
    const moved = next.find((e) => {
      const old = appointments.find((a) => a.id === e.id);
      return old && old.appointmentDate.slice(0, 16) !== toLocalIso(new Date(e.start)).slice(0, 16);
    });
    if (!moved) return;
    const old = appointments.find((a) => a.id === moved.id)!;
    const newDate = toLocalIso(new Date(moved.start)).slice(0, 16) + ':00';
    setAppointments((prev) => prev.map((a) => (a.id === old.id ? { ...a, appointmentDate: newDate } : a)));
    try {
      const saved = await updateAppointment(old.id, {
        clientName: old.clientName,
        phone: old.phone,
        licensePlate: old.licensePlate,
        appointmentDate: newDate,
        status: old.status,
      });
      handleSaved(saved);
      setError(null);
    } catch {
      setError('Programarea nu a putut fi mutată.');
      fetchRange();
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Calendar Programări</h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Click pe un interval liber pentru o programare nouă · trage o programare ca s-o muți · 🌐 = făcută online
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={15} className="animate-spin" />
              Se încarcă...
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" style={{ height: 'calc(100vh - 7.5rem)' }}>
          <ThemeProvider theme={theme}>
            <EventCalendar
              events={events}
              onEventsChange={handleEventsChange}
              localeText={roRO.components.MuiEventCalendar.defaultProps.localeText}
              dateLocale={ro}
              defaultView="week"
              views={['day', 'week', 'month', 'agenda']}
              viewConfig={{
                day: { startTime: 7, endTime: 21, initialScrollTime: 8 },
                week: { startTime: 7, endTime: 21, initialScrollTime: 8 },
              }}
              // Pe ecrane inguste panoul cu mini-calendarul porneste inchis, ca programarile sa aiba loc
              defaultPreferences={{ ampm: false, showWeekends: true, isSidePanelOpen: window.innerWidth >= 1400 }}
              preferencesMenuConfig={false}
              areEventsResizable={false}
              eventCreation={{ interaction: 'click', duration: SLOT_MINUTES }}
              onVisibleDateChange={(date) => {
                const next = rangeAround(new Date(date as Date));
                if (next.key !== range.key) setRange(next);
              }}
              // Folosim formularul nostru (verificare suprapuneri, "Începe ITP") in locul dialogului MUI
              onEventEditingStart={(occurrence, details) => {
                details.cancel();
                const start = new Date(occurrence.displayTimezone.start.value as Date);
                if (details.reason === 'creation') {
                  setCreateDate(toLocalIso(start).slice(0, 16));
                } else {
                  const appt = appointments.find((a) => a.id === occurrence.id);
                  if (appt) setEditAppt(appt);
                }
              }}
            />
          </ThemeProvider>
        </div>
      </main>

      {createDate && (
        <AppointmentModal initial={{ appointmentDate: createDate }} onClose={() => setCreateDate(null)} onSaved={handleSaved} />
      )}

      {editAppt && (
        <AppointmentModal
          appointment={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={handleSaved}
          onDeleted={(id) => setAppointments((prev) => prev.filter((a) => a.id !== id))}
          onStartItp={setItpFor}
        />
      )}

      {itpFor && (
        <AddItpModal
          prefill={itpPrefillFromAppointment(itpFor)}
          appointmentId={itpFor.id}
          onClose={() => setItpFor(null)}
          onSuccess={fetchRange}
        />
      )}
    </div>
  );
}
