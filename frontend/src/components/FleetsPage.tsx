import { useCallback, useEffect, useState } from 'react';
import { Plus, Truck, Loader2, ArrowLeft, Pencil, Trash2, KeyRound, ChevronRight, Phone } from 'lucide-react';
import type { Fleet, FleetOverview, FleetSummary } from '../types';
import { deleteFleet, getFleet, getFleetOverview, getFleetStatement, getFleets } from '../api/fleetApi';
import FleetModal from './FleetModal';
import FleetVehicles from './FleetVehicles';
import FleetStatementView from './FleetStatementView';

type Tab = 'vehicles' | 'statement';

function FleetDetail({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [tab, setTab] = useState<Tab>('vehicles');
  const [editing, setEditing] = useState(false);
  const loadStatement = useCallback((month: string) => getFleetStatement(id, month), [id]);

  const load = useCallback(() => {
    getFleet(id).then(setFleet);
    getFleetOverview(id).then(setOverview);
  }, [id]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!fleet || !confirm(`Ștergeți firma ${fleet.name}? ITP-urile mașinilor rămân la stație, dar firma nu se mai poate loga.`)) return;
    await deleteFleet(fleet.id);
    onChanged();
    onBack();
  };

  const tabCls = (t: Tab) =>
    `flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  if (!fleet || !overview) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Toate firmele
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800 truncate">{fleet.name}</h2>
          <p className="text-xs text-slate-500">
            {[fleet.cui && `CUI ${fleet.cui}`, fleet.contactName, fleet.contactPhone].filter(Boolean).join(' · ') || 'Fără date de contact'}
          </p>
          <p className="flex items-center gap-1 text-xs mt-1 text-slate-500">
            <KeyRound size={12} />
            {fleet.accountEmail ? `Cont portal: ${fleet.accountEmail}` : 'Fără cont în portal'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Pencil size={14} /> Editează
          </button>
          <button onClick={handleDelete} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Șterge
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl sm:w-fit">
        <button className={tabCls('vehicles')} onClick={() => setTab('vehicles')}>
          Mașini ({overview.vehicles.length})
        </button>
        <button className={tabCls('statement')} onClick={() => setTab('statement')}>
          Centralizator lunar
        </button>
      </div>

      {tab === 'vehicles' ? <FleetVehicles vehicles={overview.vehicles} /> : <FleetStatementView load={loadStatement} />}

      {editing && (
        <FleetModal
          fleet={fleet}
          onClose={() => setEditing(false)}
          onSaved={() => {
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// Flotele (clientii B2B) statiei: firmele, masinile lor si accesul in portal
export default function FleetsPage() {
  const [fleets, setFleets] = useState<FleetSummary[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    getFleets()
      .then(setFleets)
      .catch(() => setFleets([]));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">Flote</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Firme cu mai multe mașini: scadențe și centralizator lunar în portalul lor</p>
          </div>
          {selected === null && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shrink-0"
            >
              <Plus size={16} /> Firmă nouă
            </button>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {selected !== null ? (
          <FleetDetail id={selected} onBack={() => setSelected(null)} onChanged={load} />
        ) : !fleets ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : fleets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center max-w-lg mx-auto space-y-3">
            <Truck size={36} className="mx-auto text-blue-500" />
            <h2 className="font-semibold text-slate-800">Nicio firmă încă</h2>
            <p className="text-sm text-slate-500">
              Adaugă firmele de curierat, școlile de șoferi sau alte companii cu flote. Le aloci numerele de înmatriculare,
              iar ele văd într-un portal propriu când expiră ITP-ul fiecărei mașini și descarcă centralizatorul lunar.
            </p>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              <Plus size={16} /> Adaugă prima firmă
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fleets.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className="text-left bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5 hover:border-blue-200 hover:shadow transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800 truncate">{f.name}</p>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  {f.contactPhone && <Phone size={11} className="shrink-0" />}
                  {[f.contactName, f.contactPhone].filter(Boolean).join(' · ') || (f.cui ? `CUI ${f.cui}` : '—')}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{f.vehicleCount} mașini</span>
                  {f.expiredCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">{f.expiredCount} expirate</span>
                  )}
                  {f.expiringCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium">{f.expiringCount} expiră curând</span>
                  )}
                  {!f.accountEmail && <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-xs">fără cont</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {creating && (
        <FleetModal
          onClose={() => setCreating(false)}
          onSaved={(f) => {
            load();
            setSelected(f.id);
          }}
        />
      )}
    </div>
  );
}
