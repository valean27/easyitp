import { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, Phone, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getLeads, setLeadHandled } from '../api/adminApi';
import type { Lead } from '../types';
import { formatDateRo } from '../utils/fleet';

// Adminul: cererile de demonstratie venite din pagina de prezentare
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    getLeads()
      .then((l) => {
        setLeads(l);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const saved = await setLeadHandled(lead.id, !lead.handled);
      setLeads((ls) => ls?.map((l) => (l.id === saved.id ? saved : l)) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  const open = leads?.filter((l) => !l.handled).length ?? 0;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Cereri de demonstrație</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Din pagina de prezentare · {open} de rezolvat</p>
          </div>
        </div>
      </header>
      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6">
        {error ? (
          <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} /> Cererile nu au putut fi încărcate.
          </p>
        ) : !leads ? (
          <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
            <Inbox size={36} className="opacity-30" />
            <p className="text-sm">Nicio cerere încă.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {leads.map((l) => (
              <li key={l.id} className={`bg-white rounded-xl border border-slate-100 shadow-sm p-4 ${l.handled ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {l.name}
                      {(l.station || l.city) && <span className="font-normal text-slate-500"> · {[l.station, l.city].filter(Boolean).join(', ')}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-blue-600"><Phone size={13} /> {l.phone}</a>
                      )}
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 text-blue-600"><Mail size={13} /> {l.email}</a>
                      )}
                    </div>
                    {l.message && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap break-words">{l.message}</p>}
                    <p className="mt-2 text-xs text-slate-400">{formatDateRo(l.createdAt.slice(0, 10))} {l.createdAt.slice(11, 16)}</p>
                  </div>
                  <button
                    onClick={() => toggle(l)}
                    disabled={busyId === l.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-60 ${
                      l.handled ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {busyId === l.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {l.handled ? 'Redeschide' : 'Rezolvat'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
