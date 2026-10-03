import { useEffect, useState } from 'react';
import { X, Loader2, Trash2, AlertTriangle, ClipboardCheck, CheckCircle2, Globe } from 'lucide-react';
import { createAppointment, updateAppointment, deleteAppointment, getConflicts } from '../api/appointmentApi';
import type { Appointment, AppointmentStatus } from '../types';
import { formatTime } from '../utils/dates';
import { APPOINTMENT_STATUS_LABELS } from '../utils/appointments';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface AppointmentFormValues {
  clientName: string;
  phone: string;
  licensePlate: string;
  appointmentDate: string; // yyyy-MM-ddTHH:mm
  status: AppointmentStatus;
}

interface Props {
  // Daca e setat, modalul editeaza programarea existenta
  appointment?: Appointment;
  initial?: Partial<AppointmentFormValues>;
  onClose: () => void;
  onSaved: (appointment: Appointment) => void;
  onDeleted?: (id: number) => void;
  // Deschide formularul de ITP precompletat pentru programare
  onStartItp?: (appointment: Appointment) => void;
}

function initialValues(appointment?: Appointment, initial?: Partial<AppointmentFormValues>): AppointmentFormValues {
  if (appointment) {
    return {
      clientName: appointment.clientName,
      phone: appointment.phone ?? '',
      licensePlate: appointment.licensePlate ?? '',
      appointmentDate: appointment.appointmentDate.slice(0, 16),
      status: appointment.status,
    };
  }
  return { clientName: '', phone: '', licensePlate: '', appointmentDate: '', status: 'SCHEDULED', ...initial };
}

export default function AppointmentModal({ appointment, initial, onClose, onSaved, onDeleted, onStartItp }: Props) {
  const isEdit = !!appointment;
  const [form, setForm] = useState<AppointmentFormValues>(() => initialValues(appointment, initial));
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificam suprapunerile cand se schimba data/ora
  useEffect(() => {
    if (form.appointmentDate.length < 16) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(() => {
      getConflicts(form.appointmentDate + ':00', appointment?.id)
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [form.appointmentDate, appointment?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      clientName: form.clientName,
      phone: form.phone || null,
      licensePlate: form.licensePlate || null,
      appointmentDate: form.appointmentDate + ':00',
      status: form.status,
    };
    try {
      const saved = appointment
        ? await updateAppointment(appointment.id, payload)
        : await createAppointment(payload);
      onSaved(saved);
      onClose();
      // Marcata "Finalizat" fara ITP: deschidem direct formularul de ITP
      if (onStartItp && saved.status === 'COMPLETED' && appointment?.status !== 'COMPLETED' && !saved.itpRecordId) {
        onStartItp(saved);
      }
    } catch {
      setError('Programarea nu a putut fi salvată.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !confirm('Ștergeți această programare?')) return;
    setDeleting(true);
    try {
      await deleteAppointment(appointment.id);
      onDeleted?.(appointment.id);
      onClose();
    } catch {
      setError('Programarea nu a putut fi ștearsă.');
    } finally {
      setDeleting(false);
    }
  };

  const canStartItp = isEdit && onStartItp && !appointment.itpRecordId && appointment.status !== 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{isEdit ? 'Editează Programare' : 'Programare Nouă'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form id="appointment-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-3 overflow-y-auto">
          {appointment?.source === 'ONLINE' && (
            <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              <Globe size={14} className="shrink-0" />
              Programare făcută de client pe pagina online.
            </div>
          )}
          {appointment?.itpRecordId && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} className="shrink-0" />
              ITP-ul pentru această programare a fost înregistrat.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nume Client <span className="text-red-500">*</span>
            </label>
            <input name="clientName" required value={form.clientName} onChange={handleChange} placeholder="Ion Popescu" className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="07xx xxx xxx" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nr. Înmatriculare</label>
              <input
                name="licensePlate"
                value={form.licensePlate}
                onChange={handleChange}
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
              onChange={handleChange}
              className={INPUT_CLS}
            />
          </div>
          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Intervalul e deja ocupat:</p>
                <ul className="text-xs mt-0.5 space-y-0.5">
                  {conflicts.map((c) => (
                    <li key={c.id}>
                      {formatTime(c.appointmentDate)} · {c.clientName}
                      {c.licensePlate ? ` · ${c.licensePlate}` : ''}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-1 text-amber-700">Poți salva oricum, dacă stația are mai multe linii.</p>
              </div>
            </div>
          )}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className={INPUT_CLS + ' bg-white'}>
                {(Object.entries(APPOINTMENT_STATUS_LABELS) as [AppointmentStatus, string][]).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              {onStartItp && form.status === 'COMPLETED' && appointment?.status !== 'COMPLETED' && !appointment?.itpRecordId && (
                <p className="text-xs text-slate-400 mt-1">După salvare se deschide formularul de ITP precompletat.</p>
              )}
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex gap-1">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Șterge
              </button>
            )}
            {canStartItp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartItp!(appointment!);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <ClipboardCheck size={15} />
                Începe ITP
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Anulează
            </button>
            <button
              form="appointment-form"
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
    </div>
  );
}
