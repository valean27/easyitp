import { useEffect, useState } from 'react';
import { X, Loader2, Trash2, AlertTriangle, ClipboardCheck, CheckCircle2, Globe } from 'lucide-react';
import { createAppointment, updateAppointment, deleteAppointment, getConflicts } from '../api/appointmentApi';
import { getBookingSettings } from '../api/accountApi';
import type { Appointment, AppointmentStatus, VehicleCategory, VehicleType } from '../types';
import { formatTime } from '../utils/dates';
import { APPOINTMENT_STATUS_LABELS, LEGACY_DURATION_MINUTES, appointmentMinutes } from '../utils/appointments';
import { lineName } from '../utils/lines';
import { getInspectorTeam } from '../api/inspectorApi';
import type { Inspector } from '../types';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface AppointmentFormValues {
  clientName: string;
  phone: string;
  licensePlate: string;
  appointmentDate: string; // yyyy-MM-ddTHH:mm
  status: AppointmentStatus;
  vehicleCategory: VehicleCategory | '';
  durationMinutes: number;
  line?: number | null; // null = prima linie libera
  inspectorId?: number | null; // null = cel de pe linie
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
      vehicleCategory: appointment.vehicleCategory ?? '',
      durationMinutes: appointmentMinutes(appointment),
      line: appointment.line ?? null,
      inspectorId: appointment.inspectorId ?? null,
    };
  }
  return {
    clientName: '',
    phone: '',
    licensePlate: '',
    appointmentDate: '',
    status: 'SCHEDULED',
    vehicleCategory: '',
    durationMinutes: LEGACY_DURATION_MINUTES,
    line: null,
    inspectorId: null,
    ...initial,
  };
}

export default function AppointmentModal({ appointment, initial, onClose, onSaved, onDeleted, onStartItp }: Props) {
  const isEdit = !!appointment;
  const [form, setForm] = useState<AppointmentFormValues>(() => initialValues(appointment, initial));
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [lineNames, setLineNames] = useState<string[]>([]);
  const [team, setTeam] = useState<Inspector[]>([]);

  useEffect(() => {
    getInspectorTeam()
      .then(setTeam)
      .catch(() => setTeam([]));
  }, []);

  // Duratele statiei pe tip de vehicul; o programare noua porneste ca autoturism
  useEffect(() => {
    getBookingSettings()
      .then((s) => {
        setVehicleTypes(s.vehicleTypes);
        setLineNames(s.lineNames ?? []);
        // o linie scoasa intre timp (statia are acum mai putine linii) devine "automat"
        setForm((f) => (f.line && f.line > (s.lineNames?.length ?? 1) ? { ...f, line: null } : f));
        if (!appointment) {
          const car = s.vehicleTypes.find((t) => t.category === 'CAR');
          if (car) setForm((f) => ({ ...f, vehicleCategory: 'CAR', durationMinutes: car.minutes }));
        }
      })
      .catch(() => setVehicleTypes([]));
  }, [appointment]);

  // Verificam suprapunerile cand se schimba ora sau durata
  useEffect(() => {
    if (form.appointmentDate.length < 16 || !form.durationMinutes) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(() => {
      getConflicts(form.appointmentDate + ':00', form.durationMinutes, appointment?.id)
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [form.appointmentDate, form.durationMinutes, appointment?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // Tipul vehiculului aduce durata stabilita de statie (poate fi ajustata de mana)
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value as VehicleCategory | '';
    const type = vehicleTypes.find((t) => t.category === category);
    setForm((p) => ({
      ...p,
      vehicleCategory: category,
      durationMinutes: type ? type.minutes : p.durationMinutes,
    }));
  };

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
      vehicleCategory: form.vehicleCategory || null,
      durationMinutes: Number(form.durationMinutes),
      line: form.line ?? null,
      inspectorId: form.inspectorId ?? null,
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

  // Liniile ocupate in intervalul ales (din programarile care se suprapun)
  const multiLine = lineNames.length > 1;
  const busyLines = new Set(conflicts.map((c) => c.line).filter((l): l is number => l != null));
  const freeLines = lineNames.map((_, i) => i + 1).filter((l) => !busyLines.has(l));
  const lineBusy = form.line != null && busyLines.has(form.line);
  const showConflicts = conflicts.length > 0 && (!multiLine || lineBusy || freeLines.length === 0);

  const canStartItp = isEdit && onStartItp && !appointment.itpRecordId && appointment.status !== 'CANCELLED';

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-md">
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
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tip vehicul</label>
              <select name="vehicleCategory" value={form.vehicleCategory} onChange={handleCategoryChange} className={INPUT_CLS + ' bg-white'}>
                {form.vehicleCategory === '' && <option value="">Nespecificat</option>}
                {vehicleTypes.map((t) => (
                  <option key={t.category} value={t.category}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Durată</label>
              <div className="flex items-center gap-1.5 w-28">
                <input
                  type="number"
                  name="durationMinutes"
                  inputMode="numeric"
                  required
                  min={10}
                  max={120}
                  step={5}
                  value={form.durationMinutes}
                  onChange={handleChange}
                  className={INPUT_CLS}
                />
                <span className="text-sm text-slate-400">min</span>
              </div>
            </div>
          </div>
          {multiLine && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Linia</label>
              <select
                value={form.line ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, line: e.target.value ? Number(e.target.value) : null }))}
                className={INPUT_CLS + ' bg-white'}
              >
                <option value="">Automat (prima linie liberă)</option>
                {lineNames.map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {lineName(lineNames, i + 1)}
                    {busyLines.has(i + 1) ? ' · ocupată' : ' · liberă'}
                  </option>
                ))}
              </select>
              {conflicts.length > 0 && freeLines.length > 0 && !lineBusy && (
                <p className="text-xs text-emerald-700 mt-1">
                  Libere la ora asta: {freeLines.map((l) => lineName(lineNames, l)).join(', ')}.
                </p>
              )}
            </div>
          )}
          {team.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Inspector</label>
              <select
                value={form.inspectorId ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, inspectorId: e.target.value ? Number(e.target.value) : null }))}
                className={INPUT_CLS + ' bg-white'}
              >
                <option value="">
                  {(() => {
                    const onLine = team.find((i) => i.id === appointment?.lineInspectorId);
                    return onLine && (form.line ?? appointment?.line) === appointment?.line ? `Cel de pe linie (${onLine.name})` : 'Cel de pe linie';
                  })()}
                </option>
                {team
                  .filter((i) => i.active || i.id === form.inspectorId)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {showConflicts && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {!multiLine
                    ? 'Intervalul e deja ocupat:'
                    : lineBusy
                      ? `${lineName(lineNames, form.line!)} e ocupată la ora asta:`
                      : 'Toate liniile sunt ocupate la ora asta:'}
                </p>
                <ul className="text-xs mt-0.5 space-y-0.5">
                  {conflicts
                    .filter((c) => !lineBusy || c.line === form.line)
                    .map((c) => (
                      <li key={c.id}>
                        {formatTime(c.appointmentDate)} ({appointmentMinutes(c)} min) · {c.clientName}
                        {c.licensePlate ? ` · ${c.licensePlate}` : ''}
                        {multiLine && c.line ? ` · ${lineName(lineNames, c.line)}` : ''}
                      </li>
                    ))}
                </ul>
                <p className="text-xs mt-1 text-amber-700">
                  {multiLine && lineBusy && freeLines.length > 0
                    ? `Alege o linie liberă (${freeLines.map((l) => lineName(lineNames, l)).join(', ')}) sau salvează oricum.`
                    : multiLine
                      ? 'Poți salva oricum (ex. dacă o inspecție se termină mai repede).'
                      : 'Poți salva oricum. Dacă stația are mai multe linii, setează-le în Contul meu → Programare online.'}
                </p>
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
