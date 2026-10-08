import { useState } from 'react';
import { CalendarOff, Loader2, Plus, X } from 'lucide-react';
import DateField from './DateField';
import type { ClosedDay } from '../types';
import { addClosedDays, removeClosedDays } from '../api/accountApi';
import { closedRanges, rangeText, shortDate } from '../utils/closedDays';
import { todayIso } from '../utils/dates';
import { apiMessage } from '../utils/errors';

const DATE_CLS =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Zilele fara programari online din cardul Programare online: sarbatorile legale (bifa se salveaza cu cardul)
// si zilele inchise de statie (se salveaza pe loc, la adaugare / stergere)
export default function ClosedDaysEditor({
  holidaysClosed,
  onHolidaysClosed,
  holidays,
  closedDays,
  onClosedDays,
}: {
  holidaysClosed: boolean;
  onHolidaysClosed: (closed: boolean) => void;
  holidays: ClosedDay[];
  closedDays: ClosedDay[];
  onClosedDays: (days: ClosedDay[]) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!from) {
      setError('Alegeți ziua.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onClosedDays(await addClosedDays(from, to || null, note));
      setFrom('');
      setTo('');
      setNote('');
    } catch (err) {
      setError(apiMessage(err, 'Ziua nu a putut fi adăugată.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: { from: string; to: string }) => {
    setBusy(true);
    setError(null);
    try {
      onClosedDays(await removeClosedDays(r.from, r.to));
    } catch (err) {
      setError(apiMessage(err, 'Ziua nu a putut fi scoasă.'));
    } finally {
      setBusy(false);
    }
  };

  const ranges = closedRanges(closedDays);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <CalendarOff size={14} className="text-slate-400" />
        Zile fără programări
      </label>

      <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={holidaysClosed}
          onChange={(e) => onHolidaysClosed(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          Închis de sărbătorile legale
          <span className="block text-xs text-slate-400">
            {holidays.length > 0
              ? `Următoarele: ${holidays
                  .slice(0, 4)
                  .map((h) => `${shortDate(h.date)} ${h.name}`)
                  .join(', ')}.`
              : 'Anul Nou, Paștele, Rusaliile, 1 Mai, 1 Decembrie, Crăciunul și celelalte.'}{' '}
            Se salvează cu butonul de jos.
          </span>
        </span>
      </label>

      {ranges.length > 0 && (
        <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {ranges.map((r) => (
            <li key={r.from} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700 whitespace-nowrap">{rangeText(r)}</span>
              <span className="flex-1 min-w-0 truncate text-slate-500">{r.name ?? 'Închis'}</span>
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={busy}
                aria-label={`Redeschide ${rangeText(r)}`}
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-2">
        <p className="text-xs text-slate-500">
          Închideți stația într-o zi sau o perioadă (inventar, renovare, concediu). Clienții nu se mai pot programa online atunci;
          programările deja făcute rămân în calendar.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-500">
            De la
            <DateField value={from} onChange={setFrom} min={todayIso()} className={DATE_CLS} />
          </label>
          <label className="block text-xs text-slate-500">
            Până la <span className="text-slate-400">(opțional)</span>
            <DateField value={to} onChange={setTo} min={from || todayIso()} className={DATE_CLS} />
          </label>
        </div>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
            placeholder="Motiv (opțional), ex. Inventar"
            aria-label="Motivul închiderii"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Închide
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
