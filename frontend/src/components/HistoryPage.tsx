import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, History, Plus, Pencil, Trash2, Undo2, Merge, ArrowRightLeft, Upload, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getHistory, undoEvent, type HistoryFilter } from '../api/historyApi';
import type { AuditAction, HistoryEvent } from '../types';
import { apiMessage } from '../utils/errors';
import { formatDateRo } from '../utils/fleet';

const PAGE_SIZE = 50;

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'Toate' },
  { key: 'adds', label: 'Adăugări' },
  { key: 'changes', label: 'Modificări' },
  { key: 'deletes', label: 'Ștergeri' },
];

const ACTIONS: Record<AuditAction, { label: string; icon: LucideIcon; cls: string }> = {
  CREATE: { label: 'Adăugat', icon: Plus, cls: 'text-emerald-700 bg-emerald-50' },
  IMPORT: { label: 'Import', icon: Upload, cls: 'text-emerald-700 bg-emerald-50' },
  UPDATE: { label: 'Modificat', icon: Pencil, cls: 'text-blue-700 bg-blue-50' },
  MOVE: { label: 'Mutat', icon: ArrowRightLeft, cls: 'text-blue-700 bg-blue-50' },
  MERGE: { label: 'Unit', icon: Merge, cls: 'text-blue-700 bg-blue-50' },
  DELETE: { label: 'Șters', icon: Trash2, cls: 'text-red-700 bg-red-50' },
  RESTORE: { label: 'Restaurat', icon: Undo2, cls: 'text-amber-800 bg-amber-50' },
};

const ENTITY: Record<HistoryEvent['entityType'], string> = { ITP: 'ITP', CLIENT: 'Client', VEHICLE: 'Mașină' };

function dayLabel(iso: string): string {
  const day = iso.slice(0, 10);
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === fmt(today)) return 'Azi';
  if (day === fmt(yesterday)) return 'Ieri';
  return formatDateRo(day);
}

// Cine, ce si cand a adaugat, schimbat sau sters; stergerile din ultimele 30 de zile se pot anula
export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<HistoryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const requestId = useRef(0);
  const fetchData = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getHistory(filter, page, PAGE_SIZE);
      if (id !== requestId.current) return;
      setItems(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(apiMessage(err, 'Istoricul nu a putut fi încărcat.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const restore = async (e: HistoryEvent) => {
    setBusyId(e.id);
    setNotice(null);
    try {
      setNotice(await undoEvent(e.id));
      fetchData();
    } catch (err) {
      setError(apiMessage(err, 'Ștergerea nu a putut fi anulată.'));
    } finally {
      setBusyId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Istoric modificări</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Ștergerile din ultimele 30 de zile se pot anula</p>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-full sm:w-fit overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(0);
              }}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                filter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {notice && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{notice}</p>}
        {error && (
          <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {!loading && items.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <History size={36} className="opacity-30" />
              <p className="text-sm">Nicio modificare înregistrată încă.</p>
            </div>
          ) : (
            <ul>
              {items.map((e, i) => {
                const day = dayLabel(e.createdAt);
                const showDay = i === 0 || dayLabel(items[i - 1].createdAt) !== day;
                const a = ACTIONS[e.action];
                const Icon = a.icon;
                return (
                  <li key={e.id}>
                    {showDay && (
                      <p className="px-5 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">{day}</p>
                    )}
                    <div className="px-5 py-3 flex gap-3 border-b border-slate-50">
                      <div className={`p-2 rounded-lg h-fit ${a.cls}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold">{a.label}</span>
                          <span className="text-slate-400"> · {ENTITY[e.entityType]}</span>
                        </p>
                        <p className="text-sm text-slate-700 break-words">{e.summary}</p>
                        {e.changes && (
                          <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                            {e.changes.split('\n').map((line) => (
                              <li key={line} className="break-words">{line}</li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {e.createdAt.slice(11, 16)}
                          {e.actor ? ` · ${e.actor}` : ''}
                          {e.restoredAt ? ' · restaurat' : ''}
                        </p>
                      </div>
                      {e.canUndo && (
                        <button
                          onClick={() => restore(e)}
                          disabled={busyId !== null}
                          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 shrink-0"
                        >
                          {busyId === e.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                          <span className="hidden sm:inline">Restaurează</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} din {total}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                  Mai noi
                </button>
                <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1 || loading} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                  Mai vechi
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
