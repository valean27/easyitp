import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { Inspector, LeaveDay, LeaveKind } from '../types';
import { clearLeave, getLeaves, setLeave } from '../api/inspectorApi';
import { useTheme } from '../context/theme';
import { todayIso } from '../utils/dates';
import { MONTHS_LONG } from '../utils/dateField';
import { LEAVE_CLS, LEAVE_LABELS, LEAVE_SHORT, WEEKDAYS_SHORT, colorHex, monthDays, weekdayOf, worksOn } from '../utils/inspectors';
import { apiMessage } from '../utils/errors';

type Tool = LeaveKind | 'CLEAR';

// Planificarea lunara: cate un rand pe inspector, cate o coloana pe zi. Click pe o zi = absenta de tipul ales
// (inca un click o scoate); Shift + click = toata perioada de la ziua apasata inainte.
export default function LeavePlanner({ team, onChanged }: { team: Inspector[]; onChanged: () => void }) {
  const { resolved } = useTheme();
  const today = todayIso();
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [leaves, setLeaves] = useState<LeaveDay[] | null>(null);
  const [tool, setTool] = useState<Tool>('CONCEDIU');
  const [anchor, setAnchor] = useState<{ id: number; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => monthDays(month.y, month.m), [month]);
  const active = team.filter((i) => i.active);

  const load = useCallback(() => {
    getLeaves(days[0], days[days.length - 1])
      .then(setLeaves)
      .catch((err) => setError(apiMessage(err, 'Concediile nu au putut fi încărcate.')));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const byKey = useMemo(() => new Map((leaves ?? []).map((l) => [`${l.inspectorId}|${l.date}`, l])), [leaves]);

  const shiftMonth = (delta: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m - 1 + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });

  const apply = async (i: Inspector, date: string, range: boolean) => {
    const existing = byKey.get(`${i.id}|${date}`);
    let from = date;
    let to = date;
    if (range && anchor && anchor.id === i.id) [from, to] = anchor.date < date ? [anchor.date, date] : [date, anchor.date];
    setBusy(true);
    setError(null);
    try {
      if (tool === 'CLEAR' || (!range && existing && existing.kind === tool)) await clearLeave(i.id, from, to);
      else await setLeave(i.id, from, to, tool);
      setAnchor({ id: i.id, date });
      load();
      onChanged();
    } catch (err) {
      setError(apiMessage(err, 'Concediul nu a putut fi salvat.'));
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = new Map<number, number>();
    (leaves ?? []).forEach((l) => c.set(l.inspectorId, (c.get(l.inspectorId) ?? 0) + 1));
    return c;
  }, [leaves]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Luna de dinainte">
            <ChevronLeft size={17} />
          </button>
          <p className="w-36 text-center text-sm font-semibold text-slate-800">
            {MONTHS_LONG[month.m - 1]} {month.y}
          </p>
          <button type="button" onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Luna următoare">
            <ChevronRight size={17} />
          </button>
        </div>
        <div role="radiogroup" aria-label="Ce pune un click" className="ml-auto flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-xs text-slate-500">La click:</span>
          {(['CONCEDIU', 'MEDICAL', 'LIBER', 'CLEAR'] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tool === t}
              onClick={() => setTool(t)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition-colors ${
                tool === t ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t !== 'CLEAR' && <span className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${LEAVE_CLS[t]}`}>{LEAVE_SHORT[t]}</span>}
              {t === 'CLEAR' ? 'Șterge' : LEAVE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Adăugați întâi inspectorii.</p>
      ) : !leaves ? (
        <div className="flex items-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
        </div>
      ) : (
        <div className={`overflow-x-auto -mx-4 px-4 ${busy ? 'opacity-70' : ''}`}>
          <table className="border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white pr-2 text-left font-medium text-slate-500" />
                {days.map((d) => {
                  const weekend = weekdayOf(d) >= 6;
                  return (
                    <th key={d} className={`w-7 min-w-7 text-center font-medium ${d === today ? 'text-blue-600' : weekend ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className="block text-[10px] font-normal">{WEEKDAYS_SHORT[weekdayOf(d) - 1].slice(0, 1)}</span>
                      {Number(d.slice(8))}
                    </th>
                  );
                })}
                <th className="pl-2 text-left font-medium text-slate-500">Zile</th>
              </tr>
            </thead>
            <tbody>
              {active.map((i) => (
                <tr key={i.id}>
                  <th className="sticky left-0 z-10 bg-white pr-2 text-left font-medium text-slate-800">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorHex(i.color, resolved) }} />
                      {i.name}
                    </span>
                  </th>
                  {days.map((d) => {
                    const leave = byKey.get(`${i.id}|${d}`);
                    const works = worksOn(i, d);
                    const title = `${i.name}, ${Number(d.slice(8))}: ${leave ? LEAVE_LABELS[leave.kind] + (leave.note ? ` (${leave.note})` : '') : works ? 'lucrează' : 'liber după program'}`;
                    return (
                      <td key={d} className="p-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => apply(i, d, e.shiftKey)}
                          title={title}
                          aria-label={title}
                          className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold transition-colors ${
                            leave
                              ? LEAVE_CLS[leave.kind]
                              : works
                                ? 'bg-slate-50 hover:bg-blue-100'
                                : 'bg-transparent text-slate-300 hover:bg-slate-100'
                          } ${d === today ? 'ring-1 ring-blue-400' : ''} ${anchor?.id === i.id && anchor.date === d ? 'outline outline-2 outline-blue-500' : ''}`}
                        >
                          {leave ? LEAVE_SHORT[leave.kind] : works ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorHex(i.color, resolved) }} /> : '·'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="pl-2 tabular-nums text-slate-600">{counts.get(i.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Punct = lucrează după program, „·” = liber după program. Apăsați o zi ca s-o marcați; Shift + click marchează toată perioada de la ziua
        apăsată înainte. În zilele de absență inspectorul nu mai e pus pe linia lui.
      </p>
    </div>
  );
}
