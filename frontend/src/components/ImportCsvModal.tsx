import { useMemo, useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import type { ImportResult } from '../types';
import { importCsv } from '../api/itpApi';
import {
  FIELDS,
  type FieldKey,
  type Mapping,
  cellText,
  convert,
  guessMapping,
  headerIndex,
  parseCsv,
  toCanonicalCsv,
} from '../utils/importMapping';
import { formatDateRo } from '../utils/fleet';

interface Props {
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
}

interface Sheet {
  fileName: string;
  headers: string[];
  rows: unknown[][];
  // linia din fisier a primului rand de date (pentru mesaje)
  firstLine: number;
}

const REQUIRED: FieldKey[] = ['name', 'plate'];
// ordinea in care le vede statia (FIELDS e ordinea in care le ghicim)
const SHOWN: FieldKey[] = ['name', 'phone', 'plate', 'brand', 'model', 'vin', 'testDate', 'validity', 'expiry'];
const SELECT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

async function readSheet(file: File): Promise<Sheet> {
  const lower = file.name.toLowerCase();
  let all: unknown[][];
  if (lower.endsWith('.xlsx')) {
    // prima foaie; fara Web Worker (CSP-ul nu permite), merge direct pe fisier
    const { readSheet } = await import('read-excel-file/universal');
    all = (await readSheet(file)) as unknown[][];
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    all = parseCsv(await file.text());
  } else if (lower.endsWith('.xls')) {
    throw new Error('Fișierele .xls vechi nu se pot citi. Deschideți-l în Excel și salvați-l ca .xlsx sau .csv.');
  } else {
    throw new Error('Alegeți un fișier .xlsx sau .csv.');
  }
  const h = headerIndex(all);
  return {
    fileName: file.name,
    headers: (all[h] ?? []).map((c) => cellText(c)),
    rows: all.slice(h + 1),
    firstLine: h + 2,
  };
}

// Import din Excel sau din alta aplicatie: fisierul se citeste aici, statia verifica ce coloana e ce, apoi
// randurile merg la importul existent (acelasi format ca exportul)
export default function ImportCsvModal({ onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [defaultValidity, setDefaultValidity] = useState(12);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const s = await readSheet(file);
      if (s.headers.length === 0 || s.rows.length === 0) throw new Error('Fișierul nu are rânduri.');
      setSheet(s);
      setMapping(guessMapping(s.headers));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Fișierul nu a putut fi citit.');
    } finally {
      setReading(false);
    }
  };

  const converted = useMemo(
    () => (sheet && mapping ? convert(sheet.rows, mapping, defaultValidity, sheet.firstLine) : null),
    [sheet, mapping, defaultValidity]
  );
  const missing = mapping
    ? [...REQUIRED.filter((k) => mapping[k] < 0), ...(mapping.testDate < 0 && mapping.expiry < 0 ? (['testDate'] as FieldKey[]) : [])]
    : [];

  const handleUpload = async () => {
    if (!converted || converted.rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const csv = new File([toCanonicalCsv(converted.rows)], 'import.csv', { type: 'text/csv' });
      const res = await importCsv(csv);
      // randurile oprite aici (fara nume, numar sau data) apar langa cele raportate de server
      const merged = { ...res, skipped: res.skipped + converted.problems.length, errors: [...converted.problems, ...res.errors] };
      setResult(merged);
      onSuccess(merged);
    } catch {
      setError('Importul nu a reușit. Verificați fișierul și încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const columnSelect = (key: FieldKey) => (
    <select
      value={mapping![key]}
      onChange={(e) => setMapping((m) => (m ? { ...m, [key]: Number(e.target.value) } : m))}
      className={SELECT_CLS}
    >
      <option value={-1}>— nu există —</option>
      {sheet!.headers.map((h, i) => (
        <option key={i} value={i}>
          {h || `Coloana ${i + 1}`}
        </option>
      ))}
    </select>
  );

  return (
    <div className="modal-overlay">
      <div className={`modal-panel ${sheet && !result ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Import clienți și ITP-uri</h2>
            <p className="text-xs text-slate-500">Din Excel (.xlsx) sau CSV, din EasyITP sau din altă aplicație</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700">Import finalizat</p>
                  <p className="text-sm text-emerald-600">
                    <span className="font-bold">{result.imported}</span> noi, <span className="font-bold">{result.updated}</span>{' '}
                    actualizate, <span className="font-bold">{result.skipped}</span> sărite
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle size={15} />
                    <span className="text-sm font-semibold">
                      {result.errors.length} {result.errors.length === 1 ? 'rând sărit' : 'rânduri sărite'}
                    </span>
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-700 font-mono">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">
                  Închide
                </button>
              </div>
            </div>
          ) : !sheet || !mapping ? (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  pick(e.dataTransfer.files[0]);
                }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors border-slate-200 hover:border-blue-300 hover:bg-slate-50"
              >
                {reading ? <Loader2 size={32} className="text-blue-500 animate-spin" /> : <FileSpreadsheet size={32} className="text-slate-300" />}
                <p className="text-sm font-medium text-slate-500 text-center">Trageți fișierul aici sau click pentru a-l alege</p>
                <p className="text-xs text-slate-400">.xlsx sau .csv</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    pick(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-500 space-y-1">
                <p>
                  Merge exportul din orice altă aplicație sau lista ținută în Excel: la pasul următor alegeți ce coloană e
                  numele, numărul, data ITP-ului etc. Ajung numele, numărul și data ITP-ului (sau data expirării).
                </p>
                <p>
                  Reimportul nu dublează nimic: același număr cu aceeași dată ITP se actualizează, o dată nouă intră în istoricul
                  mașinii, iar clienții cu același nume și telefon se unesc.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600 min-w-0 truncate">
                  <span className="font-medium text-slate-800">{sheet.fileName}</span> · {converted?.rows.length ?? 0} rânduri bune
                  {converted && converted.problems.length > 0 && (
                    <span className="text-amber-700"> · {converted.problems.length} incomplete (se sar)</span>
                  )}
                </p>
                <button onClick={() => setSheet(null)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 shrink-0">
                  <ArrowLeft size={13} /> Alt fișier
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Ce coloană e ce</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2">
                  {SHOWN.map((k) => FIELDS.find((f) => f.key === k)!).map((f) => (
                    <label key={f.key} className="text-xs text-slate-500">
                      {f.label}
                      {REQUIRED.includes(f.key) && <span className="text-red-500"> *</span>}
                      <div className="mt-1">{columnSelect(f.key)}</div>
                    </label>
                  ))}
                  {mapping.validity < 0 && (
                    <label className="text-xs text-slate-500">
                      Valabilitate când lipsește
                      <select value={defaultValidity} onChange={(e) => setDefaultValidity(Number(e.target.value))} className={`${SELECT_CLS} mt-1`}>
                        {[6, 12, 24].map((m) => (
                          <option key={m} value={m}>
                            {m} luni
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  E nevoie de data ITP sau de data expirării. Fără valabilitate, o calculăm din cele două date sau folosim
                  valoarea aleasă.
                </p>
              </div>

              {missing.length > 0 ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Alegeți coloana pentru: {missing.map((k) => FIELDS.find((f) => f.key === k)!.label.toLowerCase()).join(', ')}.
                </p>
              ) : (
                converted &&
                converted.rows.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {['Client', 'Telefon', 'Număr', 'Mașina', 'Data ITP', 'Valabil până la'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {converted.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.phone}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap font-mono">{r.plate.toUpperCase()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.car}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{formatDateRo(r.testDate)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {formatDateRo(r.expiry)} <span className="text-slate-400">({r.validity} luni)</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {converted.rows.length > 5 && (
                      <p className="px-3 py-1.5 text-xs text-slate-400 bg-slate-50">… și încă {converted.rows.length - 5}</p>
                    )}
                  </div>
                )
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {!result && sheet && mapping && (
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                Anulează
              </button>
              <button
                onClick={handleUpload}
                disabled={loading || missing.length > 0 || !converted || converted.rows.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {loading ? 'Se importă...' : `Importă ${converted?.rows.length ?? 0} rânduri`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
