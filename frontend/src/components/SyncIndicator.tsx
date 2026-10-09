import { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, RefreshCw, X } from 'lucide-react';
import { dismissConflict, kindLabel, retryConflict, type OutboxConflict } from '../utils/outbox';
import { useOutbox } from '../utils/useOutbox';
import { startSync, syncOutbox } from '../utils/sync';
import { APPOINTMENT_STATUS_LABELS } from '../utils/appointments';

const when = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)} ${iso.slice(11, 16)}` : '');

// Pastila de jos (deasupra barei de navigare pe telefon); apare doar cand e ceva in coada sau de rezolvat
export default function SyncIndicator() {
  const { items, conflicts, syncing } = useOutbox();
  const [open, setOpen] = useState(false);

  useEffect(() => startSync(), []);

  if (items.length === 0 && conflicts.length === 0 && !open) return null;

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-4 z-[80] flex flex-col items-start gap-2">
        {conflicts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-700"
          >
            <AlertTriangle size={15} /> {conflicts.length === 1 ? '1 modificare de rezolvat' : `${conflicts.length} modificări de rezolvat`}
          </button>
        )}
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => syncOutbox()}
            title="Se trimit singure când revine internetul. Apăsați ca să încercați acum."
            className="flex items-center gap-2 rounded-full bg-slate-800 px-3.5 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-700"
          >
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <CloudOff size={15} />}
            {syncing
              ? 'Se sincronizează…'
              : items.length === 1
                ? '1 modificare așteaptă internetul'
                : `${items.length} modificări așteaptă internetul`}
          </button>
        )}
      </div>
      {open && <ConflictsModal conflicts={conflicts} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConflictsModal({ conflicts, onClose }: { conflicts: OutboxConflict[]; onClose: () => void }) {
  useEffect(() => {
    if (conflicts.length === 0) onClose();
  }, [conflicts.length, onClose]);

  const apply = (c: OutboxConflict) => {
    retryConflict(c.item.ref, c.current?.version);
    syncOutbox();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflicts-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 id="conflicts-title" className="font-semibold text-slate-800">De rezolvat</h2>
          <button type="button" onClick={onClose} aria-label="Închide" className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="px-5 pt-4 text-xs text-slate-500">
          Modificări făcute fără internet care nu s-au putut aplica, de obicei pentru că programarea s-a schimbat între timp (clientul a
          mutat-o sau a anulat-o, sau altcineva a modificat-o). Alegeți ce rămâne.
        </p>
        <ul className="divide-y divide-slate-100">
          {conflicts.map((c) => (
            <li key={c.item.ref} className="px-5 py-4 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {kindLabel(c.item.kind)} · {c.item.label}
              </p>
              <p className="text-sm text-red-700">{c.message}</p>
              {c.current && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Acum: </span>
                  {c.current.clientName} · {when(c.current.appointmentDate)} · {APPOINTMENT_STATUS_LABELS[c.current.status]}
                  {c.current.clientAction === 'CANCELLED' && ' (anulată de client)'}
                  {c.current.clientAction === 'RESCHEDULED' && ' (mutată de client)'}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {c.current ? (
                  <>
                    <button type="button" onClick={() => dismissConflict(c.item.ref)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                      Păstrează varianta de acum
                    </button>
                    <button type="button" onClick={() => apply(c)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Aplică modificarea mea
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        retryConflict(c.item.ref);
                        syncOutbox();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw size={14} /> Încearcă din nou
                    </button>
                    <button type="button" onClick={() => dismissConflict(c.item.ref)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50">
                      Renunță la ea
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
