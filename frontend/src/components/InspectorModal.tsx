import { useState } from 'react';
import axios from 'axios';
import { X, Loader2, Trash2, Check, KeyRound, CalendarDays, Palmtree } from 'lucide-react';
import type { Inspector, InspectorColor, InspectorDay, InspectorRequest, LeaveKind, LeaveRange } from '../types';
import { clearLeave, createInspector, deleteInspector, deleteInspectorAccount, saveInspectorAccount, setLeave, updateInspector } from '../api/inspectorApi';
import { apiMessage } from '../utils/errors';
import { COLOR_ORDER, INSPECTOR_COLORS, LEAVE_CLS, LEAVE_LABELS, LEAVE_SHORT, WEEKDAYS_SHORT, colorHex, hm, initials, rangeLabel } from '../utils/inspectors';
import { todayIso } from '../utils/dates';
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
    schedule: (inspector?.schedule ?? []).map((d) => ({ ...d, start: hm(d.start) || null, end: hm(d.end) || null })),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const canAttest = has('STATION_DEADLINES');

  // Programul: o zi bifata = lucreaza; fara nicio zi = fara program fix
  const setDay = (weekday: number, changes: Partial<InspectorDay> | null) =>
    setForm((f) => {
      const others = f.schedule.filter((d) => d.weekday !== weekday);
      const current = f.schedule.find((d) => d.weekday === weekday) ?? { weekday, line: null, start: '08:00', end: '16:00' };
      const schedule = changes === null ? others : [...others, { ...current, ...changes }];
      return { ...f, schedule: schedule.sort((a, b) => a.weekday - b.weekday) };
    });
  const workWeek = () =>
    setForm((f) => ({ ...f, schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, line: null, start: '08:00', end: '16:00' })) }));

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
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600 mb-1.5">
              <CalendarDays size={14} /> Program săptămânal
            </p>
            {form.schedule.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-500">
                Fără program fix: e pe linia lui în fiecare zi.{' '}
                <button type="button" onClick={workWeek} className="font-semibold text-blue-600 hover:underline">
                  Setează programul
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {WEEKDAYS_SHORT.map((label, i) => {
                  const weekday = i + 1;
                  const d = form.schedule.find((x) => x.weekday === weekday);
                  return (
                    <div key={weekday} className="flex items-center gap-2">
                      <label className="flex w-12 shrink-0 items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!d}
                          onChange={(e) => setDay(weekday, e.target.checked ? {} : null)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Lucrează ${label}`}
                        />
                        {label}
                      </label>
                      {d ? (
                        <>
                          <TimeSelect value={d.start} onChange={(v) => setDay(weekday, { start: v })} label={`Început ${label}`} />
                          <span className="text-slate-400">–</span>
                          <TimeSelect value={d.end} onChange={(v) => setDay(weekday, { end: v })} label={`Sfârșit ${label}`} />
                          {lineNames.length > 1 && (
                            <select
                              value={d.line ?? ''}
                              onChange={(e) => setDay(weekday, { line: e.target.value ? Number(e.target.value) : null })}
                              aria-label={`Linia ${label}`}
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm"
                            >
                              <option value="">Linia obișnuită</option>
                              {lineNames.map((_, j) => (
                                <option key={j + 1} value={j + 1}>
                                  {lineName(lineNames, j + 1)}
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">liber</span>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => set('schedule', [])} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">
                  Fără program fix
                </button>
              </div>
            )}
            {error?.field === 'schedule' && <p className="text-xs text-red-600 mt-1">{error.text}</p>}
          </div>
          {inspector && <LeaveSection inspector={inspector} onChanged={onSaved} />}
          {inspector && <AccountSection inspector={inspector} onChanged={onSaved} />}
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
          {error && error.field !== 'attestationUntil' && error.field !== 'schedule' && (
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

// Contul cu care inspectorul se logheaza (prenume.nume@statie); parola data aici se schimba la prima logare
function AccountSection({ inspector, onChanged }: { inspector: Inspector; onChanged: () => void }) {
  const [login, setLogin] = useState<string | null>(inspector.login);
  const [loginDraft, setLoginDraft] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveInspectorAccount(inspector.id, loginDraft.trim(), password);
      setMessage({
        text: login ? 'Parola a fost schimbată. La logare i se cere una nouă.' : `Cont creat: ${saved.login}. La prima logare își alege parola.`,
        ok: true,
      });
      setLogin(saved.login);
      setPassword('');
      onChanged();
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Contul nu a putut fi salvat.'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Ștergeți contul ${login}? ${inspector.name} nu se mai poate loga; datele rămân.`)) return;
    setBusy(true);
    try {
      await deleteInspectorAccount(inspector.id);
      setLogin(null);
      setMessage(null);
      onChanged();
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Contul nu a putut fi șters.'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <KeyRound size={14} /> Cont în aplicație
      </p>
      {login ? (
        <p className="text-xs text-slate-500">
          Se loghează cu <b className="text-slate-700">{login}</b> și vede doar programările lui și programul.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Cu un cont, inspectorul își vede pe telefon programările zilei și face ITP-ul direct din ele.</p>
          <input
            value={loginDraft}
            onChange={(e) => setLoginDraft(e.target.value.toLowerCase())}
            placeholder="Nume de logare (gol = prenume.nume@stație)"
            aria-label="Nume de logare"
            className={INPUT_CLS}
          />
        </>
      )}
      <div className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={login ? 'Parolă nouă (minim 8 caractere)' : 'Parolă provizorie (minim 8 caractere)'}
          aria-label="Parolă"
          autoComplete="new-password"
          className={INPUT_CLS}
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || password.length < 8}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {login ? 'Resetează' : 'Creează'}
        </button>
      </div>
      {login && (
        <button type="button" onClick={remove} disabled={busy} className="text-xs text-red-600 hover:underline">
          Șterge contul
        </button>
      )}
      {message && <p className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
    </div>
  );
}

// Ora din 15 in 15 minute (05:00 - 23:00), mereu in format 24h, oricare ar fi limba browserului
const TIMES = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => {
  const m = 5 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

function TimeSelect({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const v = value ? value.slice(0, 5) : '';
  return (
    <select
      value={v}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={label}
      className="w-[4.75rem] rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm tabular-nums"
    >
      <option value="">--:--</option>
      {v && !TIMES.includes(v) && <option value={v}>{v}</option>}
      {TIMES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

// Concediile inspectorului: cele care urmeaza (cu stergere) si adaugarea unei zile sau a unei perioade
function LeaveSection({ inspector, onChanged }: { inspector: Inspector; onChanged: () => void }) {
  const [leaves, setLeaves] = useState<LeaveRange[]>(inspector.leaves);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LeaveKind>('CONCEDIU');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<Inspector>) => {
    setBusy(true);
    setError(null);
    try {
      setLeaves((await action()).leaves);
      onChanged();
      return true;
    } catch (err) {
      setError(apiMessage(err, 'Concediul nu a putut fi salvat.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!from) return setError('Alegeți prima zi.');
    if (await run(() => setLeave(inspector.id, from, to || from, kind, note))) {
      setFrom('');
      setTo('');
      setNote('');
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <Palmtree size={14} /> Concedii și zile libere
      </p>
      {leaves.length === 0 ? (
        <p className="text-xs text-slate-500">Nicio absență de azi încolo. Zilele de absență le puteți bifa și în planificarea lunară.</p>
      ) : (
        <ul className="space-y-1">
          {leaves.map((l) => (
            <li key={l.from} className="flex items-center gap-2 text-sm text-slate-700">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${LEAVE_CLS[l.kind]}`}>{LEAVE_SHORT[l.kind]}</span>
              <span className="flex-1">
                {LEAVE_LABELS[l.kind]} {rangeLabel(l)}
                {l.note && <span className="text-slate-400"> · {l.note}</span>}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => clearLeave(inspector.id, l.from, l.to))}
                className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Șterge ${LEAVE_LABELS[l.kind]} ${rangeLabel(l)}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          De la
          <DateField value={from} onChange={setFrom} min={todayIso()} />
        </label>
        <label className="text-xs text-slate-500">
          Până la (inclusiv)
          <DateField value={to} onChange={setTo} min={from || todayIso()} />
        </label>
      </div>
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)} aria-label="Tipul absenței" className={INPUT_CLS + ' bg-white'}>
          {(Object.keys(LEAVE_LABELS) as LeaveKind[]).map((k) => (
            <option key={k} value={k}>
              {LEAVE_LABELS[k]}
            </option>
          ))}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Observație (opțional)" aria-label="Observație" className={INPUT_CLS} />
      </div>
      <button
        type="button"
        onClick={add}
        disabled={busy || !from}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Adaugă
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
