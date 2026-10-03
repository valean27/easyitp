import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Phone, MapPin, CalendarPlus, Loader2 } from 'lucide-react';
import type { FleetOverview } from '../types';
import { getMyFleet, getMyStatement } from '../api/fleetApi';
import FleetVehicles from './FleetVehicles';
import FleetStatementView from './FleetStatementView';

type Tab = 'vehicles' | 'statement';

// Portalul firmei (rol FLEET): scadentele ITP ale masinilor si centralizatorul lunar
export default function FleetPortalPage() {
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>('vehicles');
  const loadStatement = useCallback((month: string) => getMyStatement(month), []);

  useEffect(() => {
    getMyFleet()
      .then(setOverview)
      .catch(() => setError(true));
  }, []);

  const tabCls = (t: Tab) =>
    `flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Truck size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{overview?.fleetName ?? 'Flota mea'}</h1>
            <p className="text-xs text-slate-400">Scadențe ITP și centralizatoare</p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {error ? (
          <p className="text-sm text-red-600">Datele nu au putut fi încărcate. Reîncărcați pagina.</p>
        ) : !overview ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Statia care face ITP-urile: contact si programare */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-sm space-y-1">
                <p className="font-semibold text-slate-800">{overview.stationName ?? 'Stația ITP'}</p>
                {overview.stationAddress && (
                  <p className="flex items-start gap-1.5 text-slate-500">
                    <MapPin size={14} className="shrink-0 mt-0.5" /> {overview.stationAddress}
                  </p>
                )}
                {overview.stationPhone && (
                  <a href={`tel:${overview.stationPhone}`} className="flex items-center gap-1.5 text-blue-600">
                    <Phone size={14} className="shrink-0" /> {overview.stationPhone}
                  </a>
                )}
              </div>
              {overview.bookingSlug && (
                <Link
                  to={`/programare/${overview.bookingSlug}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  <CalendarPlus size={15} /> Programează un ITP
                </Link>
              )}
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
          </>
        )}
      </main>
    </div>
  );
}
