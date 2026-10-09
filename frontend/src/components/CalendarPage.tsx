import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EventCalendar } from '@mui/x-scheduler/event-calendar';
import { roRO } from '@mui/x-scheduler/locales';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ro } from 'date-fns/locale';
import { Loader2, AlertTriangle, CalendarDays, Columns3 } from 'lucide-react';
import { getAppointments, updateAppointment } from '../api/appointmentApi';
import { getBookingSettings } from '../api/accountApi';
import { apiMessage } from '../utils/errors';
import { getInspectorTeam, getLineShifts, setLineShift } from '../api/inspectorApi';
import type { Appointment, AppointmentStatus, BookingSettings, Inspector, LineShift } from '../types';
import { appointmentInspector } from '../utils/inspectors';
import AppointmentModal from './AppointmentModal';
import AddItpModal from './AddItpModal';
import LinesDayView from './LinesDayView';
import { toLocalIso, todayIso } from '../utils/dates';
import { VEHICLE_SHORT_LABELS, appointmentMinutes, itpPrefillFromAppointment } from '../utils/appointments';
import { useTheme } from '../context/theme';

const SLOT_MINUTES = 30;
const MODE_KEY = 'calendarMode';

type Mode = 'calendar' | 'lines';

// Vederea aleasa ramane pe dispozitiv
function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'lines' ? 'lines' : 'calendar';
  } catch {
    return 'calendar';
  }
}

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
  NO_SHOW: 'orange',
};

// Aceleasi culori ca in calendar (STATUS_COLOR + online)
const LEGEND: [string, string][] = [
  ['bg-blue-500', 'Programat'],
  ['bg-purple-500', 'Programat online'],
  ['bg-green-500', 'Finalizat'],
  ['bg-orange-500', 'Neprezentat'],
  ['bg-slate-400', 'Anulat'],
];

// Tema MUI aliniata cu restul aplicatiei (Tailwind): fontul paginii, albastrul principal si tema luminoasa/intunecata
function muiTheme(mode: 'light' | 'dark') {
  return createTheme({
    typography: { fontFamily: 'inherit' },
    palette:
      mode === 'dark'
        ? { mode, primary: { main: '#60a5fa' }, background: { default: '#0b1120', paper: '#131c2e' }, divider: '#263044' }
        : { mode, primary: { main: '#2563eb' } },
    shape: { borderRadius: 10 },
    components: { MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } } },
  });
}

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

// multiLine: statia are mai multe linii, deci titlul incepe cu linia (L1, L2 ...)
function toEvent(a: Appointment, multiLine: boolean, team: Inspector[]): SchedulerEvent {
  const start = a.appointmentDate.slice(0, 19);
  const line = multiLine && a.status !== 'CANCELLED' ? (a.line ? `L${a.line} · ` : '⚠ ') : '';
  return {
    id: a.id,
    title: `${line}${a.overlap ? '⚠ ' : ''}${a.itpRecordId ? '✓ ' : ''}${a.source === 'ONLINE' ? '🌐 ' : ''}${a.clientName}${a.licensePlate ? ' · ' + a.licensePlate : ''}`,
    description:
      [
        a.vehicleCategory ? VEHICLE_SHORT_LABELS[a.vehicleCategory] : null,
        a.phone,
        appointmentInspector(a, team)?.name ?? null,
        a.clientAction === 'CANCELLED' ? 'Anulat de client' : a.status === 'CANCELLED' ? 'Anulat' : null,
        a.clientAction === 'RESCHEDULED' ? 'Mutat de client' : null,
        a.status === 'NO_SHOW' ? 'Neprezentat' : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    start,
    // Evenimentul ocupa exact cat dureaza inspectia (20 min autoturism, 45 min autoutilitara etc.)
    end: addMinutes(start, appointmentMinutes(a)),
    color: a.source === 'ONLINE' && a.status === 'SCHEDULED' ? 'purple' : STATUS_COLOR[a.status],
    // Programarile finalizate sau anulate nu se mai muta
    draggable: a.status === 'SCHEDULED',
  };
}

// Pe telefon meniul lateral (sertarul MUI) ramane deschis dupa ce alegi o vedere sau o zi; nu are prop
// de control, asa ca apasam noi butonul lui de inchidere (daca sertarul nu e deschis, nu se intampla nimic)
function closeCompactDrawer(container: HTMLElement | null) {
  window.setTimeout(() => {
    container?.querySelector<HTMLButtonElement>('.MuiEventCalendar-sidePanelDrawerCloseButton')?.click();
  }, 150);
}

// ?date=yyyy-mm-dd (din notificari): calendarul se deschide pe ziua aceea; alta zi = calendarul porneste din nou
export default function CalendarRoute() {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('date') ?? '';
  const linkDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  return <CalendarPage key={linkDate ?? ''} linkDate={linkDate} />;
}

function CalendarPage({ linkDate }: { linkDate: string | null }) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const { resolved } = useTheme();
  const theme = useMemo(() => muiTheme(resolved), [resolved]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(() => rangeAround(linkDate ? new Date(`${linkDate}T12:00:00`) : new Date()));

  const [createAt, setCreateAt] = useState<{ appointmentDate: string; line?: number | null } | null>(null);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [linesDate, setLinesDate] = useState(() => linkDate ?? todayIso());
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [team, setTeam] = useState<Inspector[]>([]);
  const [shifts, setShifts] = useState<LineShift[]>([]);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);

  const fetchRange = useCallback(async () => {
    setLoading(true);
    try {
      setAppointments(await getAppointments(toLocalIso(range.start), toLocalIso(range.end)));
      setError(null);
    } catch {
      setError('Programările nu au putut fi încărcate.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchRange();
  }, [fetchRange]);

  // Liniile statiei (numar si nume) si programul, pentru vederea "Pe linii"
  useEffect(() => {
    getBookingSettings().then(setSettings).catch(() => setSettings(null));
    getInspectorTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  // Cine e pe fiecare linie in ziua din vederea "Pe linii"
  useEffect(() => {
    if (mode !== 'lines') return;
    getLineShifts(linesDate).then(setShifts).catch(() => setShifts([]));
  }, [mode, linesDate]);

  const changeShift = async (line: number, inspectorId: number | null, reset: boolean) => {
    try {
      setShifts(await setLineShift(linesDate, line, inspectorId, reset));
      fetchRange();
    } catch {
      setError('Inspectorul liniei nu a putut fi schimbat.');
    }
  };

  const lineNames = settings?.lineNames ?? [''];
  const multiLine = lineNames.length > 1;
  const events = useMemo(() => appointments.map((a) => toEvent(a, multiLine, team)), [appointments, multiLine, team]);

  const changeMode = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // fara stocare locala vederea nu se mai tine minte
    }
  };

  const changeLinesDate = (date: string) => {
    setLinesDate(date);
    const next = rangeAround(new Date(`${date}T12:00:00`));
    if (next.key !== range.key) setRange(next);
  };

  const handleSaved = (saved: Appointment) =>
    setAppointments((prev) =>
      prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]
    );

  // Drag & drop: mutam programarea la noua ora (durata ramane aceeasi). Linia null = serverul o pastreaza
  // daca e libera la noua ora, altfel alege prima linie libera
  const moveAppointment = async (old: Appointment, newDate: string, line: number | null) => {
    setAppointments((prev) => prev.map((a) => (a.id === old.id ? { ...a, appointmentDate: newDate, line: line ?? a.line } : a)));
    try {
      const saved = await updateAppointment(old.id, {
        clientName: old.clientName,
        phone: old.phone,
        licensePlate: old.licensePlate,
        email: old.email ?? null,
        appointmentDate: newDate,
        status: old.status,
        vehicleCategory: old.vehicleCategory,
        durationMinutes: old.durationMinutes,
        line,
        inspectorId: old.inspectorId ?? null,
        version: old.version,
      });
      handleSaved(saved);
      setError(null);
    } catch (err) {
      setError(apiMessage(err, 'Programarea nu a putut fi mutată.'));
      fetchRange();
    }
  };

  const handleEventsChange = (next: SchedulerEvent[]) => {
    const moved = next.find((e) => {
      const old = appointments.find((a) => a.id === e.id);
      return old && old.appointmentDate.slice(0, 16) !== toLocalIso(new Date(e.start)).slice(0, 16);
    });
    if (!moved) return;
    const old = appointments.find((a) => a.id === moved.id)!;
    moveAppointment(old, toLocalIso(new Date(moved.start)).slice(0, 16) + ':00', null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">Calendar<span className="hidden sm:inline"> Programări</span></h1>
            <p className="text-xs text-slate-400 hidden md:block">
              Click pe un loc liber pentru o programare nouă · trage o programare ca s-o muți
              {mode === 'lines' ? ' pe altă oră sau altă linie' : ''} · 🌐 = făcută online
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <Loader2 size={15} className="animate-spin text-slate-400" aria-label="Se încarcă" />}
            <div role="radiogroup" aria-label="Vederea calendarului" className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
              {(
                [
                  ['calendar', 'Calendar', <CalendarDays key="c" size={15} />],
                  ['lines', 'Pe linii', <Columns3 key="l" size={15} />],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => changeMode(value)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                    mode === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {icon} {value === 'lines' ? <><span className="sm:hidden">Linii</span><span className="hidden sm:inline">{label}</span></> : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-screen-2xl mx-auto px-2 sm:px-6 py-2 sm:py-4 flex flex-col gap-2 sm:gap-3">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}
        {mode === 'lines' && !multiLine && settings && (
          <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            Stația are o singură linie. Dacă aveți mai multe, setați-le în{' '}
            <Link to="/account#linii" className="font-semibold underline">Contul meu → Linii ITP</Link>: fiecare linie primește coloana ei, iar
            clienții se pot programa la aceeași oră cât timp o linie e liberă.
          </div>
        )}
        <div ref={calendarRef} className="flex-1 min-h-[28rem] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {mode === 'lines' ? (
            <LinesDayView
              date={linesDate}
              onDateChange={changeLinesDate}
              appointments={appointments}
              lineNames={lineNames}
              open={settings?.open}
              close={settings?.close}
              team={team}
              shifts={shifts}
              onShiftChange={changeShift}
              onCreate={(appointmentDate, line) => setCreateAt({ appointmentDate, line })}
              onOpen={setEditAppt}
              onMove={moveAppointment}
            />
          ) : (
          <ThemeProvider theme={theme}>
            <EventCalendar
              events={events}
              onEventsChange={handleEventsChange}
              localeText={roRO.components.MuiEventCalendar.defaultProps.localeText}
              dateLocale={ro}
              // Pe telefon o saptamana intreaga nu incape: pornim pe ziua curenta
              defaultView={window.innerWidth < 768 ? 'day' : 'week'}
              defaultVisibleDate={linkDate ? new Date(`${linkDate}T12:00:00`) : undefined}
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
              onViewChange={() => closeCompactDrawer(calendarRef.current)}
              onVisibleDateChange={(date) => {
                const next = rangeAround(new Date(date as Date));
                if (next.key !== range.key) setRange(next);
                closeCompactDrawer(calendarRef.current);
              }}
              // Folosim formularul nostru (verificare suprapuneri, "Începe ITP") in locul dialogului MUI
              onEventEditingStart={(occurrence, details) => {
                details.cancel();
                const start = new Date(occurrence.displayTimezone.start.value as Date);
                if (details.reason === 'creation') {
                  setCreateAt({ appointmentDate: toLocalIso(start).slice(0, 16) });
                } else {
                  const appt = appointments.find((a) => a.id === occurrence.id);
                  if (appt) setEditAppt(appt);
                }
              }}
            />
          </ThemeProvider>
          )}
        </div>
        <ul className="shrink-0 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500" aria-label="Legenda culorilor">
          {LEGEND.map(([cls, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}
            </li>
          ))}
        </ul>
      </main>

      {createAt && (
        <AppointmentModal initial={createAt} onClose={() => setCreateAt(null)} onSaved={handleSaved} />
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
          prefill={itpPrefillFromAppointment(itpFor, appointmentInspector(itpFor, team)?.name)}
          appointmentId={itpFor.id}
          onClose={() => setItpFor(null)}
          onSuccess={fetchRange}
        />
      )}
    </div>
  );
}
