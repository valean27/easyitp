import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  Search,
  Loader2,
  Upload,
  Download,
  X,
} from 'lucide-react';
import { getDashboard, deleteItpRecord, exportCsv } from '../api/itpApi';
import type { DashboardEntry, ImportResult } from '../types';
import AddItpModal from './AddItpModal';
import ImportCsvModal from './ImportCsvModal';

function getRowStyle(zileRamase: number): string {
  if (zileRamase < 0) return 'text-red-600 bg-red-50';
  if (zileRamase <= 30) return 'text-amber-600 bg-amber-50';
  return 'text-slate-700';
}

function getDaysTag(zileRamase: number) {
  if (zileRamase < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
        <AlertTriangle size={13} />
        Expirat ({Math.abs(zileRamase)} zile)
      </span>
    );
  }
  if (zileRamase <= 30) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
        <Clock size={13} />
        {zileRamase} zile
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
      <CheckCircle2 size={13} />
      {zileRamase} zile
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4`}>
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportCsv();
    } catch {
      showToast('Eroare la exportul CSV.', 'error');
    } finally {
      setExporting(false);
    }
  }, [showToast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getDashboard();
      setData(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    if (!confirm('Sigur doriți să ștergeți această înregistrare?')) return;
    setDeletingId(id);
    try {
      await deleteItpRecord(id);
      await fetchData();
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportSuccess = useCallback((result: ImportResult) => {
    fetchData();
    showToast(
      `Import finalizat: ${result.imported} importate, ${result.skipped} ignorate.`,
      'success'
    );
  }, [fetchData, showToast]);

  const filtered = data.filter(
    (row) =>
      row.numeSofer.toLowerCase().includes(search.toLowerCase()) ||
      row.numarInmatriculare.toLowerCase().includes(search.toLowerCase()) ||
      row.marca.toLowerCase().includes(search.toLowerCase()) ||
      (row.vin ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = data.length;
  const expiredCount = data.filter((r) => r.zileRamase < 0).length;
  const expiringSoonCount = data.filter(
    (r) => r.zileRamase >= 0 && r.zileRamase <= 30
  ).length;
  const validCount = data.filter((r) => r.zileRamase > 30).length;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Car size={20} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-800">EasyITP</span>
              <span className="hidden sm:inline ml-2 text-sm text-slate-400">
                Evidență Inspecții Tehnice
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Reîncarcă"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span>Adaugă ITP</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total înregistrări"
            value={totalCount}
            icon={<Car size={18} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="ITP valid"
            value={validCount}
            icon={<CheckCircle2 size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            label="Expiră în 30 zile"
            value={expiringSoonCount}
            icon={<Clock size={18} className="text-amber-600" />}
            color="bg-amber-50"
          />
          <StatCard
            label="Expirat"
            value={expiredCount}
            icon={<AlertTriangle size={18} className="text-red-600" />}
            color="bg-red-50"
          />
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Table Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              Înregistrări ITP
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length} din {totalCount})
              </span>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Caută după nume, nr. înmatriculare..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Se încarcă...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Car size={40} className="opacity-30" />
                <p className="text-sm">
                  {search ? 'Niciun rezultat găsit.' : 'Nu există înregistrări. Adaugă prima înregistrare ITP!'}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      '#',
                      'Nume Șofer',
                      'Contact',
                      'Marcă',
                      'VIN',
                      'Nr. Înmatriculare',
                      'Data ITP',
                      'Val. (luni)',
                      'Următor ITP',
                      'Zile Rămase',
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((row, idx) => {
                    const rowCls = getRowStyle(row.zileRamase);
                    return (
                      <tr
                        key={row.id}
                        className={`hover:brightness-95 transition-colors ${rowCls}`}
                      >
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {row.numeSofer}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.contact || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{row.marca}</div>
                          {(row.model || row.year) && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {[row.model, row.year ? `(${row.year})` : null].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {row.vin || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                          {row.numarInmatriculare}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.dataItp}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {row.valabilitateLuni}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {row.dataUrmatorItp}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getDaysTag(row.zileRamase)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Șterge"
                          >
                            {deletingId === row.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
            ITP Expirat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            Expiră în ≤ 30 zile
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
            ITP Valid
          </span>
        </div>
      </main>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showModal && (
        <AddItpModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchData}
        />
      )}

      {showImportModal && (
        <ImportCsvModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
