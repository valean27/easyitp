import { useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Loader2 } from 'lucide-react';
import { getAppointments } from '../api/appointmentApi';
import type { Appointment } from '../types';
import AppointmentModal from './AppointmentModal';
import AddItpModal from './AddItpModal';
import { toLocalIso } from '../utils/dates';
import { APPOINTMENT_STATUS_COLORS, itpPrefillFromAppointment } from '../utils/appointments';

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);
  const range = useRef<{ start: Date; end: Date } | null>(null);

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    range.current = { start, end };
    setLoading(true);
    try {
      setAppointments(await getAppointments(toLocalIso(start), toLocalIso(end)));
    } catch {
      /* silently ignore fetch errors */
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = () => {
    if (range.current) fetchRange(range.current.start, range.current.end);
  };

  const events = appointments.map((a) => ({
    id: String(a.id),
    title: `${a.itpRecordId ? '✓ ' : ''}${a.source === 'ONLINE' ? '🌐 ' : ''}${a.clientName}${a.licensePlate ? ' · ' + a.licensePlate : ''}`,
    start: a.appointmentDate,
    color: APPOINTMENT_STATUS_COLORS[a.status],
    extendedProps: { appointment: a },
  }));

  const handleSaved = (saved: Appointment) =>
    setAppointments((prev) =>
      prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]
    );

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Calendar Programări</h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Click pe un slot pentru a adăuga · Click pe o programare pentru a edita sau a începe ITP-ul · 🌐 = făcută online
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

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: 'Azi',
              month: 'Lună',
              week: 'Săptămână',
              day: 'Zi',
            }}
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            allDaySlot={false}
            dateClick={(info) => setCreateDate(info.dateStr.slice(0, 16))}
            eventClick={(info: EventClickArg) => setEditAppt(info.event.extendedProps.appointment as Appointment)}
            datesSet={(info) => fetchRange(info.start, info.end)}
            events={events}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            nowIndicator
          />
        </div>
      </main>

      {createDate && (
        <AppointmentModal
          initial={{ appointmentDate: createDate.length === 10 ? `${createDate}T09:00` : createDate }}
          onClose={() => setCreateDate(null)}
          onSaved={handleSaved}
        />
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
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
