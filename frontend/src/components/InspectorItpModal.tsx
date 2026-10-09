import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, Loader2, ClipboardCheck } from 'lucide-react';
import type { Appointment, ItpFormData, ItpStatus } from '../types';
import { getMakes, getModels, type CarMake, type CarModel } from '../api/carApi';
import { getItpPrefill, startMyItp } from '../api/inspectorPortalApi';
import { validateItp, firstError, type ItpErrors, type ItpField } from '../utils/itpValidation';
import { STATUS_LABELS } from '../utils/fleet';
import { todayIso } from '../utils/dates';
import { apiMessage } from '../utils/errors';
import DateField from './DateField';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const ERROR_CLS = ' border-red-400 ring-1 ring-red-300';

// "Incepe ITP" din contul inspectorului: formularul ITP precompletat din programare (si din ultimul ITP al masinii).
// Se salveaza pe statie, cu numele inspectorului, iar programarea devine "Finalizat".
export default function InspectorItpModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (a: Appointment) => void;
}) {
  const [form, setForm] = useState<ItpFormData>(() => ({
    name: appointment.clientName,
    phone: appointment.phone ?? '',
    brand: '',
    model: '',
    year: null,
    vin: '',
    licensePlate: appointment.licensePlate ?? '',
    testDate: todayIso(),
    validityMonths: 12,
    status: 'PASSED',
    mileage: null,
    price: null,
    observations: '',
    reminderConsent: appointment.reminderConsent ?? false,
  }));
  const [makes, setMakes] = useState<CarMake[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [errors, setErrors] = useState<ItpErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Masina din ultimul ITP cu acelasi numar: marca, modelul, anul, VIN-ul nu se mai tasteaza
  useEffect(() => {
    getItpPrefill(appointment.id)
      .then((p) =>
        setForm((f) => ({
          ...f,
          name: p.name || f.name,
          phone: p.phone || f.phone,
          licensePlate: p.licensePlate || f.licensePlate,
          brand: p.brand ?? f.brand,
          model: p.model ?? f.model,
          year: p.year ?? f.year,
          vin: p.vin ?? f.vin,
          validityMonths: p.validityMonths ?? f.validityMonths,
          price: f.price ?? p.price ?? null,
        }))
      )
      .catch(() => undefined);
    getMakes()
      .then(setMakes)
      .catch(() => setMakes([]));
  }, [appointment.id]);

  const make = useMemo(() => makes.find((m) => m.name.toLowerCase() === form.brand.trim().toLowerCase()), [makes, form.brand]);

  useEffect(() => {
    if (!make) return;
    getModels(make.id)
      .then(setModels)
      .catch(() => setModels([]));
  }, [make]);

  const set = <K extends keyof ItpFormData>(key: K, value: ItpFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const found = validateItp(form, todayIso(), new Date().getFullYear());
    setErrors(found);
    const first = firstError(found);
    if (first) {
      document.getElementsByName(first)[0]?.focus();
      return;
    }
    setSaving(true);
    try {
      // nebifat = acordul clientului ramane cum era (nu il retragem din greseala)
      const saved = await startMyItp(appointment, {
        ...form,
        licensePlate: form.licensePlate.trim().toUpperCase(),
        vin: form.vin.trim().toUpperCase(),
        reminderConsent: form.reminderConsent ? true : undefined,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      const field = axios.isAxiosError(err) ? (err.response?.data as { field?: string } | undefined)?.field : undefined;
      if (field) setErrors({ [field as ItpField]: apiMessage(err, 'Verificați câmpul.') });
      else setError(apiMessage(err, 'ITP-ul nu a putut fi salvat.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = (f: ItpField) => INPUT_CLS + (errors[f] ? ERROR_CLS : '');
  const err = (f: ItpField) => errors[f] && <p className="text-xs text-red-600 mt-1">{errors[f]}</p>;

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <ClipboardCheck size={18} className="text-emerald-600" /> ITP · {appointment.appointmentDate.slice(11, 16)}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200" aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        <form id="inspector-itp" onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nr. înmatriculare *</label>
              <input name="licensePlate" value={form.licensePlate} onChange={(e) => set('licensePlate', e.target.value)} className={fieldCls('licensePlate') + ' uppercase'} />
              {err('licensePlate')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input name="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" className={fieldCls('phone')} />
              {err('phone')}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nume client *</label>
            <input name="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={fieldCls('name')} />
            {err('name')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Marcă *</label>
              <input name="brand" list="insp-makes" value={form.brand} onChange={(e) => set('brand', e.target.value)} className={fieldCls('brand')} />
              <datalist id="insp-makes">
                {makes.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
              {err('brand')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Model</label>
              <input name="model" list="insp-models" value={form.model} onChange={(e) => set('model', e.target.value)} className={INPUT_CLS} />
              <datalist id="insp-models">
                {(make ? models : []).map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">An</label>
              <input name="year" inputMode="numeric" value={form.year ?? ''} onChange={(e) => set('year', num(e.target.value))} className={fieldCls('year')} />
              {err('year')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">VIN</label>
              <input name="vin" value={form.vin} onChange={(e) => set('vin', e.target.value)} maxLength={17} className={fieldCls('vin') + ' uppercase'} />
              {err('vin')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Data ITP *</label>
              <DateField name="testDate" value={form.testDate} onChange={(v) => set('testDate', v)} max={todayIso()} />
              {err('testDate')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Valabilitate</label>
              <select name="validityMonths" value={form.validityMonths} onChange={(e) => set('validityMonths', Number(e.target.value))} className={fieldCls('validityMonths') + ' bg-white'}>
                {[6, 12, 24].map((m) => (
                  <option key={m} value={m}>
                    {m} luni
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-slate-600 mb-1">Rezultat</p>
            <div role="radiogroup" aria-label="Rezultat" className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS_LABELS) as ItpStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={form.status === s}
                  onClick={() => set('status', s)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    form.status === s
                      ? s === 'PASSED'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : s === 'FAILED'
                          ? 'border-red-500 bg-red-50 text-red-800 ring-1 ring-red-500'
                          : 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Kilometraj</label>
              <input name="mileage" inputMode="numeric" value={form.mileage ?? ''} onChange={(e) => set('mileage', num(e.target.value))} className={fieldCls('mileage')} />
              {err('mileage')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Preț (RON)</label>
              <input name="price" inputMode="decimal" value={form.price ?? ''} onChange={(e) => set('price', num(e.target.value.replace(',', '.')))} className={fieldCls('price')} />
              {err('price')}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Observații</label>
            <textarea value={form.observations} onChange={(e) => set('observations', e.target.value)} rows={2} className={INPUT_CLS} />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!form.reminderConsent}
              onChange={(e) => set('reminderConsent', e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Clientul e de acord să fie anunțat înainte de următorul ITP</span>
          </label>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            Anulează
          </button>
          <button
            form="inspector-itp"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Salvează ITP-ul
          </button>
        </div>
      </div>
    </div>
  );
}
