import { useState } from 'react';
import axios from 'axios';
import { X, Loader2, Trash2, Check } from 'lucide-react';
import type { Inspector, InspectorColor, InspectorRequest } from '../types';
import { createInspector, deleteInspector, updateInspector } from '../api/inspectorApi';
import { apiMessage } from '../utils/errors';
import { COLOR_ORDER, INSPECTOR_COLORS, colorHex, initials } from '../utils/inspectors';
import { lineName } from '../utils/lines';
import { useTheme } from '../context/theme';
import { usePlan } from '../context/plan';
import DateField from './DateField';
import { PlanBadge } from './PlanLock';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const ERROR_CLS = ' border-red-400 ring-1 ring-red-300';

interface Props {
  inspector?: Inspector;
  lineNames: string[];
  // culorile deja folosite, ca un inspector nou sa primeasca una libera
  usedColors: (InspectorColor | null)[];
  onClose: () => void;
  onSaved: () => void;
}

// Adaugarea / editarea unui inspector: nume, telefon, culoare, linia obisnuita, atestatul, activ
export default function InspectorModal({ inspector, lineNames, usedColors, onClose, onSaved }: Props) {
  const { resolved } = useTheme();
  const { has } = usePlan();
  const [form, setForm] = useState<InspectorRequest>(() => ({
    name: inspector?.name ?? '',
    phone: inspector?.phone ?? '',
    color: inspector?.color ?? COLOR_ORDER.find((c) => !usedColors.includes(c)) ?? 'blue',
    active: inspector?.active ?? true,
    defaultLine: inspector?.defaultLine ?? null,
    attestationUntil: inspector?.attestationUntil ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const canAttest = has('STATION_DEADLINES');

  const set = <K extends keyof InspectorRequest>(key: K, value: InspectorRequest[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, phone: form.phone?.trim() || null };
    try {
      if (inspector) await updateInspector(inspector.id, payload);
      else await createInspector(payload);
      onSaved();
      onClose();
    } catch (err) {
      const field = axios.isAxiosError(err) ? (err.response?.data as { field?: string } | undefined)?.field : undefined;
      setError({ text: apiMessage(err, 'Inspectorul nu a putut fi salvat.'), field });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!inspector) return;
    if (!confirm(`Ștergeți inspectorul ${inspector.name}? ITP-urile făcute de el își păstrează numele. Dacă doar a plecat, mai bine îl marcați inactiv.`)) return;
    setSaving(true);
    try {
      await deleteInspector(inspector.id);
      onSaved();
      onClose();
    } catch (err) {
      setError({ text: apiMessage(err, 'Inspectorul nu a putut fi șters.') });
      setSaving(false);
    }
  };

  const errorFor = (field: string) => (error?.field === field ? ERROR_CLS : '');

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: colorHex(form.color, resolved) }}
            >
              {initials(form.name || '?')}
            </span>
            <h2 className="text-lg font-semibold text-slate-800">{inspector ? 'Editează inspector' : 'Inspector nou'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors" aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        <form id="inspector-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nume <span className="text-red-500">*</span>
            </label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} required autoFocus placeholder="Ion Popescu" className={INPUT_CLS + errorFor('name')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
            <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="07xx xxx xxx" className={INPUT_CLS + errorFor('phone')} />
          </div>
          <div>
            <p className="block text-sm font-medium text-slate-600 mb-1.5">Culoare în calendar și grafice</p>
            <div role="radiogroup" aria-label="Culoare" className="flex flex-wrap gap-2">
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={INSPECTOR_COLORS[c].label}
                  title={INSPECTOR_COLORS[c].label + (usedColors.includes(c) && inspector?.color !== c ? ' (folosită)' : '')}
                  onClick={() => set('color', c)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition ${form.color === c ? 'ring-2 ring-slate-500' : ''}`}
                  style={{ background: colorHex(c, resolved) }}
                >
                  {form.color === c && <Check size={15} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          {lineNames.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Linia pe care lucrează de obicei</label>
              <select
                value={form.defaultLine ?? ''}
                onChange={(e) => set('defaultLine', e.target.value ? Number(e.target.value) : null)}
                className={INPUT_CLS + ' bg-white' + errorFor('defaultLine')}
              >
                <option value="">Niciuna anume</option>
                {lineNames.map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {lineName(lineNames, i + 1)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Programările de pe linia asta îi revin lui; o zi anume o schimbați în „Cine e pe linii”.</p>
            </div>
          )}
          <div>
            <label className="flex items-center text-sm font-medium text-slate-600 mb-1">
              Atestat valabil până la <PlanBadge feature="STATION_DEADLINES" />
            </label>
            {canAttest ? (
              <DateField value={form.attestationUntil ?? ''} onChange={(v) => set('attestationUntil', v || null)} />
            ) : (
              <p className="text-xs text-slate-500">Cu pachetul Pro, atestatul intră în termenele stației și primiți alertă înainte să expire.</p>
            )}
            {error?.field === 'attestationUntil' && <p className="text-xs text-red-600 mt-1">{error.text}</p>}
          </div>
          {inspector && (
            <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Activ
                <span className="block text-xs text-slate-400">Un inspector inactiv nu mai apare la alegere, dar rămâne în istoric și rapoarte.</span>
              </span>
            </label>
          )}
          {error && error.field !== 'attestationUntil' && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error.text}</p>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div>
            {inspector && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2 size={15} /> Șterge
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Anulează
            </button>
            <button
              form="inspector-form"
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
