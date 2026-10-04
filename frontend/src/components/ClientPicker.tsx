import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { getClients } from '../api/clientApi';
import type { ClientSummary } from '../types';

// Cautare si alegere a unui alt client (pentru mutarea unei masini sau unirea a doi clienti)
export default function ClientPicker({
  excludeId,
  actionLabel,
  onPick,
  onCancel,
}: {
  excludeId: number;
  actionLabel: string;
  onPick: (client: ClientSummary) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      setLoading(true);
      getClients(term, 0, 8)
        .then((page) => setResults(page.items.filter((c) => c.id !== excludeId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, excludeId]);

  const shown = q.trim().length < 2 ? [] : results;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută clientul după nume, telefon sau număr..."
          className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {shown.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white max-h-56 overflow-y-auto">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[c.phone, c.plates.join(', ')].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => onPick(c)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !loading && shown.length === 0 && (
        <p className="text-xs text-slate-500 px-1">Niciun alt client găsit.</p>
      )}
      <button onClick={onCancel} className="text-xs font-medium text-slate-500 hover:text-slate-700">
        Renunță
      </button>
    </div>
  );
}
