import { useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { X, Loader2, Trash2 } from 'lucide-react';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from '../api/appointmentApi';
import type { Appointment, AppointmentStatus } from '../types';

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#94a3b8',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Programat',
  COMPLETED: 'Finalizat',
  CANCELLED: 'Anulat',
};

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface ApptForm {
  clientName: string;
  phone: string;
  licensePlate: string;
  appointmentDate: string;
  status: AppointmentStatus;
}

const emptyForm: ApptForm = {
  clientName: '',
  phone: '',
  licensePlate: '',
  appointmentDate: '',
  status: 'SCHEDULED',
};

function ApptFormFields({
  form,
  onChange,
  showStatus,
}: {
  form: ApptForm;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  showStatus: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Nume Client <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="clientName"
          required
          value={form.clientName}
          onChange={onChange}
          placeholder="Ion Popescu"
          className={INPUT_CLS}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
          <input
            type="text"
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="07xx xxx xxx"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Nr. Înmatriculare</label>
          <input
            type="text"
            name="licensePlate"
            value={form.licensePlate}
            onChange={onChange}
            placeholder="B 123 ABC"
            className={INPUT_CLS + ' uppercase'}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Data și Ora <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          name="appointmentDate"
          required
          value={form.appointmentDate}
          onChange={onChange}
          className={INPUT_CLS}
        />
      </div>
      {showStatus && (
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={onChange}
            className={INPUT_CLS + ' bg-white'}
          >
            {(Object.entries(STATUS_LABELS) as [AppointmentStatus, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ApptForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<ApptForm>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    const s = start.toISOString().slice(0, 19);
    const e = end.toISOString().slice(0, 19);
    setLoading(true);
    try {
      const data = await getAppointments(s, e);
      setAppointments(data);
    } catch {
      /* silently ignore fetch errors */
    } finally {
      setLoading(false);
    }
  }, []);

  const events = appointments.map((a) => ({
    id: String(a.id),
    title: `${a.clientName}${a.licensePlate ? ' · ' + a.licensePlate : ''}`,
    start: a.appointmentDate,
    color: STATUS_COLORS[a.status],
    extendedProps: { appointment: a },
  }));

  const handleDateClick = (info: { dateStr: string }) => {
    setCreateForm({ ...emptyForm, appointmentDate: info.dateStr.slice(0, 16) });
    setShowCreate(true);
  };

  const handleEventClick = (info: EventClickArg) => {
    const appt = info.event.extendedProps.appointment as Appointment;
    setEditAppt(appt);
    setEditForm({
      clientName: appt.clientName,
      phone: appt.phone ?? '',
      licensePlate: appt.licensePlate ?? '',
      appointmentDate: appt.appointmentDate.slice(0, 16),
      status: appt.status,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createAppointment({
        clientName: createForm.clientName,
        phone: createForm.phone || null,
        licensePlate: createForm.licensePlate || null,
        appointmentDate: createForm.appointmentDate + ':00',
        status: createForm.status,
      });
      setAppointments((prev) => [...prev, created]);
      setShowCreate(false);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAppt) return;
    setEditSaving(true);
    try {
      const updated = await updateAppointment(editAppt.id, {
        clientName: editForm.clientName,
        phone: editForm.phone || null,
        licensePlate: editForm.licensePlate || null,
        appointmentDate: editForm.appointmentDate + ':00',
        status: editForm.status,
      });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditAppt(null);
    } catch {
      /* ignore */
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editAppt) return;
    if (!confirm('Ștergeți această programare?')) return;
    setEditDeleting(true);
    try {
      await deleteAppointment(editAppt.id);
      setAppointments((prev) => prev.filter((a) => a.id !== editAppt.id));
      setEditAppt(null);
    } catch {
      /* ignore */
    } finally {
      setEditDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Calendar Programări</h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Click pe un slot pentru a adăuga · Click pe o programare pentru a edita
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
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={(info) => fetchRange(info.start, info.end)}
            events={events}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            nowIndicator
          />
        </div>
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">Programare Nouă</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form id="create-appt-form" onSubmit={handleCreate} className="px-6 py-5">
              <ApptFormFields
                form={createForm}
                onChange={(e) => setCreateForm((p) => ({ ...p, [e.target.name]: e.target.value }))}
                showStatus={false}
              />
            </form>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Anulează
              </button>
              <button
                form="create-appt-form"
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Salvează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">Editează Programare</h2>
              <button
                onClick={() => setEditAppt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form id="edit-appt-form" onSubmit={handleEdit} className="px-6 py-5">
              <ApptFormFields
                form={editForm}
                onChange={(e) => setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }))}
                showStatus={true}
              />
            </form>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={handleDelete}
                disabled={editDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {editDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Șterge
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditAppt(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Anulează
                </button>
                <button
                  form="edit-appt-form"
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {editSaving && <Loader2 size={15} className="animate-spin" />}
                  Salvează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
