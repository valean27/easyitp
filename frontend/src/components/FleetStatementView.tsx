import { useEffect, useState } from 'react';
import { Download, Printer, Loader2, FileText } from 'lucide-react';
import type { FleetStatement } from '../types';
import { STATUS_LABELS, formatDateRo, monthLabel, recentMonths, statementCsv, statementHtml } from '../utils/fleet';

const MONTHS = recentMonths(12);
const ron = (v: number) => `${v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`;

function download(content: string, fileName: string) {
  // BOM, ca Excel sa citeasca diacriticele corect
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Pagina se deschide intr-o fereastra noua; din dialogul de tiparire se poate salva ca PDF
function print(st: FleetStatement) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(statementHtml(st));
  w.document.close();
  w.focus();
  w.print();
}

// Centralizatorul lunar al unei flote: toate ITP-urile din luna aleasa, cu total, de descarcat ca CSV sau PDF
// extra: ce mai apare sub total pentru luna aleasa (la manager: factura Oblio)
export default function FleetStatementView({
  load,
  extra,
}: {
  load: (month: string) => Promise<FleetStatement>;
  extra?: (month: string) => React.ReactNode;
}) {
  // Implicit luna trecuta: centralizatorul se cere de obicei la inceputul lunii, pentru luna incheiata
  const [month, setMonth] = useState(MONTHS[1]);
  const [statement, setStatement] = useState<FleetStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load(month)
      .then((s) => !cancelled && setStatement(s))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load, month]);

  const fileBase = statement ? `centralizator_itp_${statement.fleetName.replace(/[^\w]+/g, '_')}_${statement.month}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-700">Centralizator lunar</h2>
        </div>
        <select
          value={month}
          onChange={(e) => {
            setLoading(true);
            setError(false);
            setMonth(e.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center text-sm text-slate-400 py-4">
            <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
          </div>
        ) : error || !statement ? (
          <p className="text-sm text-red-600">Centralizatorul nu a putut fi încărcat.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-slate-800">{ron(statement.total)}</p>
                <p className="text-xs text-slate-500">
                  {statement.rows.length} ITP în {monthLabel(statement.month)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => download(statementCsv(statement), `${fileBase}.csv`)}
                  disabled={statement.rows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={() => print(statement)}
                  disabled={statement.rows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Printer size={14} /> PDF / Tipărește
                </button>
              </div>
            </div>
            {extra && statement.rows.length > 0 && <div key={month}>{extra(month)}</div>}

            {statement.rows.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Niciun ITP în această lună.</p>
            ) : (
              <>
              {/* Telefon: lista */}
              <ul className="sm:hidden divide-y divide-slate-100 -mx-4 border-y border-slate-100">
                {statement.rows.map((r, i) => (
                  <li key={`${r.plate}-${r.date}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-800">{r.plate}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {formatDateRo(r.date)} · {[r.brand, r.model].filter(Boolean).join(' ') || '—'} · {STATUS_LABELS[r.status]}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-slate-800 whitespace-nowrap">{r.price != null ? ron(r.price) : '—'}</span>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                    <tr>
                      <th className="text-left font-semibold px-2 py-2">Data</th>
                      <th className="text-left font-semibold px-2 py-2">Număr</th>
                      <th className="text-left font-semibold px-2 py-2">Vehicul</th>
                      <th className="text-left font-semibold px-2 py-2">Rezultat</th>
                      <th className="text-right font-semibold px-2 py-2">Preț</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statement.rows.map((r, i) => (
                      <tr key={`${r.plate}-${r.date}-${i}`}>
                        <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{formatDateRo(r.date)}</td>
                        <td className="px-2 py-2 font-mono font-semibold text-slate-800 whitespace-nowrap">{r.plate}</td>
                        <td className="px-2 py-2 text-slate-600">{[r.brand, r.model].filter(Boolean).join(' ')}</td>
                        <td className="px-2 py-2 text-slate-600">{STATUS_LABELS[r.status]}</td>
                        <td className="px-2 py-2 text-right text-slate-800 whitespace-nowrap">{r.price != null ? ron(r.price) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
            <p className="text-[11px] text-slate-400">
              Document informativ. Factura fiscală se emite separat de stația ITP.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
