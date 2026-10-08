import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Columns3, Loader2, Minus, Plus, CheckCircle2, AlertTriangle, HardHat } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { Inspector, StationLines } from '../types';
import { getLines, updateLines } from '../api/accountApi';
import { getInspectorTeam } from '../api/inspectorApi';
import { colorHex } from '../utils/inspectors';
import { useTheme } from '../context/theme';

const MAX_LINES = 10;

type Message = { text: string; type: 'success' | 'error' } | null;

const linesLabel = (n: number) => (n === 1 ? '1 linie' : `${n} linii`);

// Liniile ITP ale statiei: cate sunt (cate vehicule se verifica deodata) si numele lor.
// Le folosesc calendarul („Pe linii”), programarea online si inspectorii (linia obisnuita).
export default function LinesCard() {
  const { resolved } = useTheme();
  const [saved, setSaved] = useState<StationLines | null>(null);
  const [count, setCount] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  const [team, setTeam] = useState<Inspector[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getLines()
      .then((l) => {
        setSaved(l);
        setCount(l.count);
        setNames(l.names);
      })
      .catch(() => setMessage({ text: 'Liniile nu au putut fi încărcate.', type: 'error' }));
    getInspectorTeam()
      .then((t) => setTeam(t.filter((i) => i.active)))
      .catch(() => setTeam([]));
  }, []);

  const setLineCount = (n: number) => {
    const next = Math.min(MAX_LINES, Math.max(1, n));
    setCount(next);
    // numele liniilor scoase raman in formular pana la salvare, ca sa revina daca adaugati linia inapoi
    setNames((prev) => Array.from({ length: Math.max(next, prev.length) }, (_, i) => prev[i] ?? ''));
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await updateLines({ count, names: names.slice(0, count) });
      setSaved(result);
      setCount(result.count);
      setNames(result.names);
      setMessage({ text: 'Liniile au fost salvate.', type: 'success' });
    } catch {
      setMessage({ text: `Alegeți între 1 și ${MAX_LINES} linii; un nume are cel mult 40 de caractere.`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const onLine = (line: number) => team.filter((i) => i.defaultLine === line);
  const removedFrom = saved && count < saved.count ? count + 1 : null;
  const stranded = removedFrom ? team.filter((i) => i.defaultLine !== null && i.defaultLine >= removedFrom) : [];

  return (
    <SettingsCard
      id="linii"
      icon={<Columns3 size={15} />}
      title="Linii ITP"
      summary={saved && (saved.count === 1 ? '1 linie' : `${saved.count} linii${saved.names.some((n) => n) ? ` · ${saved.names.filter((n) => n).join(', ')}` : ''}`)}
    >
      {!saved ? (
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            Câte vehicule pot fi verificate în același timp. Fiecare linie are coloana ei în Calendar → „Pe linii”, iar clienții se pot
            programa online la aceeași oră cât timp o linie e liberă.
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Linii în stație</span>
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setLineCount(count - 1)}
                disabled={count <= 1}
                aria-label="O linie mai puțin"
                className="p-2 text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Minus size={15} />
              </button>
              <span className="w-10 text-center text-sm font-semibold text-slate-800 tabular-nums" aria-live="polite">
                {count}
              </span>
              <button
                type="button"
                onClick={() => setLineCount(count + 1)}
                disabled={count >= MAX_LINES}
                aria-label="O linie în plus"
                className="p-2 text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {Array.from({ length: count }, (_, i) => {
              const line = i + 1;
              const inspectors = onLine(line);
              return (
                <li key={line} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="shrink-0 w-7 h-7 rounded-md bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {line}
                    </span>
                    <input
                      value={names[i] ?? ''}
                      maxLength={40}
                      onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                      placeholder={`Linia ${line}`}
                      aria-label={`Numele liniei ${line}`}
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end sm:w-44 pl-9 sm:pl-0">
                    {inspectors.length === 0 ? (
                      <span className="text-xs text-slate-400">fără inspector fix</span>
                    ) : (
                      inspectors.map((ins) => (
                        <span key={ins.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-700">
                          <span className="w-2 h-2 rounded-full" style={{ background: colorHex(ins.color, resolved) }} />
                          {ins.name}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-400">
            Numele e opțional (ex. „Autoturisme”, „Camioane”); gol = „Linia 1”, „Linia 2”… Inspectorul obișnuit al fiecărei linii îl alegeți
            pe pagina <Link to="/inspectori" className="text-blue-600 hover:underline">Inspectori</Link>, iar acolo schimbați și cine lucrează
            pe ce linie într-o anumită zi.
          </p>

          {removedFrom && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {removedFrom === saved.count ? `Linia ${removedFrom} dispare` : `Liniile ${removedFrom}–${saved.count} dispar`}. Programările
                de pe ele rămân în calendar (coloana „scoasă”) și le puteți muta pe altă linie.
                {stranded.length > 0 && (
                  <>
                    {' '}
                    Inspectorii care lucrează acolo de obicei ({stranded.map((i) => i.name).join(', ')}) rămân fără linie fixă; le alegeți alta
                    pe pagina Inspectori.
                  </>
                )}
              </span>
            </div>
          )}

          {message && (
            <div
              className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
                message.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              Salvează {linesLabel(count)}
            </button>
            <Link
              to="/inspectori"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <HardHat size={14} /> Inspectori pe linii
            </Link>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
