import { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, Phone, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getLeads, getWithdrawals, setLeadHandled, setWithdrawalHandled, type Withdrawal } from '../api/adminApi';
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
        <Withdrawals />
      </main>
    </div>
  );
}

// Cererile de retragere din contract (pagina publica /retragere): de rezolvat in 14 zile
function Withdrawals() {
  const [list, setList] = useState<Withdrawal[] | null>(null);

  useEffect(() => {
    getWithdrawals()
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list || list.length === 0) return null;
  const toggle = async (w: Withdrawal) => {
    const saved = await setWithdrawalHandled(w.id, !w.handled);
    setList((ls) => ls?.map((x) => (x.id === saved.id ? saved : x)) ?? null);
  };
  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-base font-bold text-slate-800">Cereri de retragere din contract</h2>
      <ul className="space-y-3">
        {list.map((w) => (
          <li key={w.id} className={`bg-white rounded-xl border p-4 ${w.handled ? 'border-slate-100 opacity-60' : 'border-red-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{w.name}</p>
                <p className="text-sm text-slate-600 break-all">{w.email} · {w.contract}</p>
                {w.message && <p className="mt-1 text-sm text-slate-500">{w.message}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(w.createdAt).toLocaleString('ro-RO')} · {w.userId ? `cont #${w.userId}` : 'fără cont găsit'}
                </p>
              </div>
              <button
                onClick={() => toggle(w)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {w.handled ? 'Redeschide' : 'Rezolvată'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
