import { useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { ImportResult } from '../types';
import { importCsv } from '../api/itpApi';

interface Props {
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
}

export default function ImportCsvModal({ onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith('.csv')) {
      setFile(dropped);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await importCsv(file);
      setResult(res);
      onSuccess(res);
    } catch {
      setError('Eroare la încărcarea fișierului. Verificați formatul CSV și încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const isDone = result !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Import CSV</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!isDone ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  file
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                {file ? (
                  <>
                    <FileText size={32} className="text-blue-500" />
                    <p className="text-sm font-medium text-blue-700">{file.name}</p>
                    <p className="text-xs text-blue-500">
                      {(file.size / 1024).toFixed(1)} KB — Click pentru a schimba
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      Trage fișierul CSV aici sau click pentru a selecta
                    </p>
                    <p className="text-xs text-slate-400">Doar fișiere .csv</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Expected format hint */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600">Coloane așteptate în CSV:</p>
                <p className="font-mono break-all leading-relaxed">
                  Nume sofer, Contact, Marca vehicul, VIN, Numar inmatriculare,
                  Data efectuare ITP, Perioada valabilitate ITP (luni),
                  Data urmatorul ITP, Zile ramase ITP
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Se importă...
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      Importă
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Result view */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700">Import finalizat</p>
                  <p className="text-sm text-emerald-600">
                    <span className="font-bold">{result.imported}</span> înregistrări importate,{' '}
                    <span className="font-bold">{result.skipped}</span> ignorate
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle size={15} />
                    <span className="text-sm font-semibold">
                      {result.errors.length} avertisment{result.errors.length > 1 ? 'e' : ''}
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
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Închide
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
