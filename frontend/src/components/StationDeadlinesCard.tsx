import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Pencil, Trash2, Plus, Check } from 'lucide-react';
import SettingsCard from './SettingsCard';
import PlanLock from './PlanLock';
import { usePlan } from '../context/plan';
import type { StationDeadline, StationDeadlineInput, StationDeadlineKind } from '../types';
import {
  createStationDeadline,
  deleteStationDeadline,
  getStationDeadlines,
  updateStationDeadline,
} from '../api/stationDeadlineApi';
import { getInspectors } from '../api/accountApi';
import { STATION_DEADLINE_KINDS, daysText } from '../utils/stationDeadlines';
import { formatDateRo } from '../utils/fleet';
import { apiMessage } from '../utils/errors';
import DateField from './DateField';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const EMPTY: StationDeadlineInput = { kind: 'AUTORIZATIE_RAR', title: null, dueDate: '', notes: null };

function DeadlineForm({
  initial,
  inspectors,
  onSave,
  onCancel,
}: {
  initial: StationDeadlineInput;
  inspectors: string[];
  onSave: (data: StationDeadlineInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const meta = STATION_DEADLINE_KINDS.find((k) => k.kind === form.kind)!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, title: form.title?.trim() || null, notes: form.notes?.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="text-xs text-slate-500">
        Tip
        <select
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as StationDeadlineKind }))}
          className={`${INPUT_CLS} bg-white mt-1`}
        >
          {STATION_DEADLINE_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        Expiră la
        <div className="mt-1">
          <DateField required value={form.dueDate} onChange={(iso) => setForm((f) => ({ ...f, dueDate: iso }))} className={INPUT_CLS} />
        </div>
      </label>
      <label className="sm:col-span-2 text-xs text-slate-500">
        {meta.titleLabel}
        <input
          value={form.title ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={meta.placeholder}
          list={form.kind === 'ATESTAT_INSPECTOR' ? 'station-inspectors' : undefined}
          maxLength={120}
          className={`${INPUT_CLS} mt-1`}
        />
        <datalist id="station-inspectors">
          {inspectors.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>
      <label className="sm:col-span-2 text-xs text-slate-500">
        Observații (opțional)
        <input
          value={form.notes ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          maxLength={300}
          className={`${INPUT_CLS} mt-1`}
        />
      </label>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
          Renunță
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvează
        </button>
      </div>
    </form>
  );
}

// Contul meu -> Termenele statiei: autorizatia RAR, verificarile metrologice, atestatele inspectorilor
// Termenele statiei sunt in pachetul Pro
export default function StationDeadlinesCard() {
  const { has } = usePlan();
  if (!has('STATION_DEADLINES')) {
    return (
      <SettingsCard id="termene" icon={<ShieldCheck size={15} />} title="Termenele stației" summary="În pachetul Pro">
        <div className="px-6 py-5">
          <PlanLock feature="STATION_DEADLINES" text="Autorizația RAR, metrologia și atestatele inspectorilor, cu alertă înainte de expirare, fac parte din pachetul Pro." />
        </div>
      </SettingsCard>
    );
  }
  return <StationDeadlinesBody />;
}

function StationDeadlinesBody() {
  const [list, setList] = useState<StationDeadline[] | null>(null);
  const [inspectors, setInspectors] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    getStationDeadlines()
      .then(setList)
      .catch((err) => setError(apiMessage(err, 'Termenele nu au putut fi încărcate.')));

  useEffect(() => {
    load();
    getInspectors().then(setInspectors).catch(() => setInspectors([]));
  }, []);

  const save = async (id: number | 'new', data: StationDeadlineInput) => {
    setError(null);
    try {
      if (id === 'new') await createStationDeadline(data);
      else await updateStationDeadline(id, data);
      setEditing(null);
      await load();
    } catch (err) {
      setError(apiMessage(err, 'Termenul nu a putut fi salvat.'));
    }
  };

  const remove = async (d: StationDeadline) => {
    if (!window.confirm(`Ștergeți termenul „${d.label}${d.title ? ` · ${d.title}` : ''}”?`)) return;
    try {
      await deleteStationDeadline(d.id);
      await load();
    } catch (err) {
      setError(apiMessage(err, 'Termenul nu a putut fi șters.'));
    }
  };

  return (
    <SettingsCard
      id="termene"
      icon={<ShieldCheck size={15} />}
      title="Termenele stației"
      summary={
        list &&
        (list.some((d) => d.due)
          ? `${list.filter((d) => d.due).length} de reînnoit curând`
          : list.length > 0
            ? `${list.length} ${list.length === 1 ? 'termen' : 'termene'}, niciunul aproape`
            : 'Niciun termen adăugat')
      }
    >
      <div className="px-6 py-5 space-y-3">
        <p className="text-xs text-slate-500">
          Autorizația RAR, verificările metrologice ale echipamentelor, atestatele inspectorilor. Cele care se apropie apar
          pe prima pagină și în rezumatul de dimineață (autorizația cu 60 de zile înainte, atestatele cu 45, restul cu 30).
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!list ? (
          <div className="flex items-center text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((d) =>
              editing === d.id ? (
                <li key={d.id}>
                  <DeadlineForm
                    initial={{ kind: d.kind, title: d.title, dueDate: d.dueDate, notes: d.notes }}
                    inspectors={inspectors}
                    onSave={(data) => save(d.id, data)}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="text-slate-800">
                      <span className="font-medium">{d.label}</span>
                      {d.title && <span className="text-slate-600"> · {d.title}</span>}
                    </p>
                    <p className="text-xs">
                      <span className="text-slate-500">{formatDateRo(d.dueDate)} · </span>
                      <span className={d.daysLeft < 0 ? 'text-red-600 font-semibold' : d.due ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                        {daysText(d.daysLeft)}
                      </span>
                    </p>
                    {d.notes && <p className="text-xs text-slate-400 mt-0.5">{d.notes}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <button onClick={() => setEditing(d.id)} title="Editează / reînnoiește" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remove(d)} title="Șterge" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              )
            )}
            {list.length === 0 && editing !== 'new' && <li className="text-sm text-slate-400">Niciun termen adăugat.</li>}
          </ul>
        )}
        {editing === 'new' ? (
          <DeadlineForm initial={EMPTY} inspectors={inspectors} onSave={(data) => save('new', data)} onCancel={() => setEditing(null)} />
        ) : (
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus size={15} /> Adaugă un termen
          </button>
        )}
      </div>
    </SettingsCard>
  );
}
