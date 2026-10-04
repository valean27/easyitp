import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Users, AlertTriangle, ChevronDown, ChevronUp, Merge, History } from 'lucide-react';
import { getClients, getDuplicates, mergeClient } from '../api/clientApi';
import type { ClientSummary, DuplicateGroup } from '../types';
import { formatDateRo } from '../utils/fleet';
import { apiMessage } from '../utils/errors';
import ClientModal from './ClientModal';

const PAGE_SIZE = 30;

function ExpiryTag({ c }: { c: ClientSummary }) {
  if (c.daysLeft == null) return <span className="text-xs text-slate-400">—</span>;
  const cls =
    c.daysLeft < 0
      ? 'text-red-700 bg-red-50 border-red-200'
      : c.daysLeft <= 30
      ? 'text-amber-800 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  const text =
    c.daysLeft < 0 ? `Expirat de ${-c.daysLeft} zile` : c.daysLeft <= 30 ? `Expiră în ${c.daysLeft} zile` : formatDateRo(c.nextItpDate);
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${cls}`}>{text}</span>;
}

// Posibile dubluri: clientii din grup trec la cel cu cele mai multe masini
function Duplicates({ groups, onMerged }: { groups: DuplicateGroup[]; onMerged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mergeGroup = async (group: DuplicateGroup, index: number) => {
    const keeper = [...group.clients].sort((a, b) => b.vehicleCount - a.vehicleCount || a.id - b.id)[0];
    const others = group.clients.filter((c) => c.id !== keeper.id);
    if (!confirm(`Unim ${others.map((c) => c.name).join(', ')} în ${keeper.name}? Toate mașinile trec la ${keeper.name}.`)) return;
    setBusy(index);
    setError(null);
    try {
      for (const c of others) await mergeClient(c.id, keeper.id);
      onMerged();
    } catch (err) {
      setError(apiMessage(err, 'Clienții nu au putut fi uniți.'));
      onMerged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle size={16} />
          {groups.length} {groups.length === 1 ? 'posibilă dublură' : 'posibile dubluri'} (aceeași persoană trecută de mai multe ori)
        </span>
        {open ? <ChevronUp size={16} className="text-amber-700" /> : <ChevronDown size={16} className="text-amber-700" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {groups.map((g, i) => (
            <div key={g.clients.map((c) => c.id).join('-')} className="bg-white rounded-lg border border-amber-100 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-amber-800">{g.reason}</span>
                <button
                  onClick={() => mergeGroup(g, i)}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60"
                >
                  {busy === i ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
                  Unește
                </button>
              </div>
              <ul className="text-sm text-slate-700 space-y-0.5">
                {g.clients.map((c) => (
                  <li key={c.id}>
                    {c.name}
                    <span className="text-xs text-slate-500">
                      {' '}· {[c.phone, `${c.vehicleCount} ${c.vehicleCount === 1 ? 'mașină' : 'mașini'}`].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-amber-800">Nu sunt aceeași persoană? Lăsați-i așa; deschideți fișa pentru detalii.</p>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ClientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const requestId = useRef(0);
  const fetchData = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getClients(query, page, PAGE_SIZE);
      if (id !== requestId.current) return;
      if (result.items.length === 0 && page > 0) {
        setPage(page - 1);
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      setError(false);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [query, page]);

  const fetchDuplicates = useCallback(() => {
    getDuplicates().then(setDuplicates).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const refresh = () => {
    fetchData();
    fetchDuplicates();
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Clienți</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Un client cu toate mașinile lui și istoricul ITP al fiecăreia</p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
            <Link to="/history" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" title="Istoric modificări">
              <History size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {duplicates.length > 0 && <Duplicates groups={duplicates} onMerged={refresh} />}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              Clienți <span className="ml-1 text-sm font-normal text-slate-400">({total})</span>
            </h2>
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Caută după nume, telefon sau număr..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && items.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <AlertTriangle size={32} className="opacity-40" />
              <p className="text-sm">Clienții nu au putut fi încărcați.</p>
              <button onClick={fetchData} className="text-sm font-medium text-blue-600 hover:underline">Încearcă din nou</button>
            </div>
          ) : !loading && items.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <Users size={36} className="opacity-30" />
              <p className="text-sm">{query ? 'Niciun client găsit.' : 'Clienții apar aici după primul ITP.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)} className="w-full text-left px-5 py-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="min-w-0 sm:w-64">
                      <p className="font-medium text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.phone || 'Fără telefon'}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                      {c.plates.map((p) => (
                        <span key={p} className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">{p.toUpperCase()}</span>
                      ))}
                      {c.vehicleCount > c.plates.length && (
                        <span className="text-xs text-slate-500">+{c.vehicleCount - c.plates.length}</span>
                      )}
                    </div>
                    <div className="sm:w-44 sm:text-right">
                      <ExpiryTag c={c} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} din {total}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                  Înapoi
                </button>
                <span className="tabular-nums">{page + 1} / {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1 || loading} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                  Înainte
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {openId !== null && <ClientModal clientId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}
