import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Eye,
  Pencil,
  Printer,
  History,
} from 'lucide-react';
import { getRecords, getSummary, getHistory, deleteItpRecord, exportCsv } from '../api/itpApi';
import type { DashboardEntry, DashboardSummary, ImportResult, ItpStatus } from '../types';
import AddItpModal from './AddItpModal';
import ImportCsvModal from './ImportCsvModal';
import TodayAgenda from './TodayAgenda';
import InvoiceButton from './InvoiceButton';
import { getItpInvoice, issueItpInvoice } from '../api/invoicingApi';
import StationDeadlineAlert from './StationDeadlineAlert';
import { offerUndo } from '../utils/undo';
import { apiMessage } from '../utils/errors';

function getStatusBadge(status: ItpStatus) {
  const cfg: Record<ItpStatus, { label: string; cls: string }> = {
    PASSED: { label: 'Promovat', cls: 'bg-emerald-100 text-emerald-700' },
    FAILED: { label: 'Respins', cls: 'bg-red-100 text-red-700' },
    RECHECK: { label: 'Reverificare', cls: 'bg-amber-100 text-amber-700' },
  };
  const { label, cls } = cfg[status] ?? cfg.PASSED;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-sm text-slate-500 w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800 break-words">{value ?? '—'}</span>
    </div>
  );
}

const PAGE_SIZE = 50;
const EMPTY_SUMMARY: DashboardSummary = { vehicles: 0, valid: 0, expiringSoon: 0, expired: 0 };

function DetailsModal({ entry, onClose }: { entry: DashboardEntry; onClose: () => void }) {
  // Istoricul vehiculului vine de la server (tabelul are doar pagina curenta)
  const [history, setHistory] = useState<DashboardEntry[]>([entry]);
  const loadInvoice = useCallback(() => getItpInvoice(entry.id), [entry.id]);
  useEffect(() => {
    if (!entry.numarInmatriculare) return;
    getHistory(entry.numarInmatriculare)
      .then((rows) => {
        if (rows.length > 0) setHistory(rows);
      })
      .catch(() => {});
  }, [entry.numarInmatriculare]);

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Detalii Înregistrare ITP</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Date Șofer</p>
            <Row label="Nume" value={entry.numeSofer} />
            <Row label="Telefon" value={entry.contact} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Vehicul</p>
            <Row label="Marcă / Model" value={[entry.marca, entry.model].filter(Boolean).join(' ')} />
            <Row label="An fabricație" value={entry.year} />
            <Row label="VIN" value={<span className="font-mono">{entry.vin || '—'}</span>} />
            <Row label="Nr. Înmatriculare" value={<span className="font-mono font-semibold">{entry.numarInmatriculare}</span>} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Date ITP</p>
            <Row label="Data ITP" value={entry.dataItp} />
            <Row label="Valabilitate" value={`${entry.valabilitateLuni} luni`} />
            <Row label="Următor ITP" value={entry.dataUrmatorItp} />
            <Row label="Zile rămase" value={entry.zileRamase < 0 ? `Expirat (${Math.abs(entry.zileRamase)} zile)` : `${entry.zileRamase} zile`} />
            <Row label="Rezultat" value={getStatusBadge(entry.status)} />
            <Row label="Inspector" value={entry.inspector} />
            <Row label="Kilometraj" value={entry.mileage != null ? `${entry.mileage.toLocaleString()} km` : null} />
            <Row label="Preț" value={entry.price != null ? `${entry.price.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON` : null} />
          </div>
          {history.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <History size={12} /> Istoric ITP vehicul ({history.length})
              </p>
              <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${h.id === entry.id ? 'bg-blue-50' : ''}`}
                  >
                    <span className="font-medium text-slate-700">{h.dataItp}</span>
                    <span className="text-slate-500">{h.valabilitateLuni} luni</span>
                    {getStatusBadge(h.status)}
                    <span className="text-slate-500 text-xs">
                      {h.mileage != null ? `${h.mileage.toLocaleString()} km` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {entry.observations && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Observații</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
                {entry.observations}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          {(entry.price ?? 0) > 0 && (
            <div className="mr-auto">
              <InvoiceButton
                load={loadInvoice}
                issue={() => issueItpInvoice(entry.id)}
                label="Factură"
                confirmText={`Emiteți în Oblio factura pentru ${entry.numeSofer} (${entry.numarInmatriculare})? Factura este reală și nu se poate anula din EasyITP.`}
              />
            </div>
          )}
          <Link
            to={`/fisa/${entry.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          >
            <Printer size={15} /> Fișa ITP
          </Link>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

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
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 ${
        onClick ? 'cursor-pointer hover:border-blue-200 hover:shadow transition' : ''
      }`}
    >
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<DashboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [onlyLatest, setOnlyLatest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  // Cautarea pleaca spre server la o mica pauza dupa tastare
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [viewEntry, setViewEntry] = useState<DashboardEntry | null>(null);
  const [editEntry, setEditEntry] = useState<DashboardEntry | null>(null);
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

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Raspunsurile vechi (tastare rapida) nu suprascriu rezultatul cererii mai noi
  const requestId = useRef(0);
  const fetchData = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [result, stats] = await Promise.all([
        getRecords({ page, size: PAGE_SIZE, q: query, onlyLatest }),
        getSummary(),
      ]);
      if (id !== requestId.current) return;
      // Pagina a ramas goala (ex. dupa stergere): mergem la cea dinainte
      if (result.items.length === 0 && page > 0) {
        setPage(page - 1);
        return;
      }
      setRows(result.items);
      setTotal(result.total);
      setSummary(stats);
      setLoadError(false);
    } catch {
      if (id === requestId.current) setLoadError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, query, onlyLatest]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fara confirmare: stergerea se poate anula din bara de jos sau din Istoric
  const handleDelete = async (row: DashboardEntry) => {
    setDeletingId(row.id);
    try {
      const eventId = await deleteItpRecord(row.id);
      offerUndo(`ITP ${row.numarInmatriculare.toUpperCase()} șters`, eventId, fetchData);
      await fetchData();
    } catch (err) {
      showToast(apiMessage(err, 'ITP-ul nu a putut fi șters.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportSuccess = useCallback((result: ImportResult) => {
    fetchData();
    showToast(
      `Import finalizat: ${result.imported} noi, ${result.updated} actualizate, ${result.skipped} ignorate.`,
      'success'
    );
  }, [fetchData, showToast]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/history"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Istoric modificări"
            >
              <History size={16} />
            </Link>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Reîncarcă"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span className="whitespace-nowrap">
                <span className="hidden sm:inline">Adaugă </span>ITP
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <StationDeadlineAlert />
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Vehicule"
            value={summary.vehicles}
            icon={<Car size={18} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="ITP valid"
            value={summary.valid}
            icon={<CheckCircle2 size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            label="Expiră în 30 zile"
            value={summary.expiringSoon}
            icon={<Clock size={18} className="text-amber-600" />}
            color="bg-amber-50"
            onClick={() => navigate('/reminders')}
          />
          <StatCard
            label="Expirat"
            value={summary.expired}
            icon={<AlertTriangle size={18} className="text-red-600" />}
            color="bg-red-50"
          />
        </div>

        <TodayAgenda onItpSaved={fetchData} />

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Table Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              Înregistrări ITP
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({total})
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none sm:ml-auto sm:mr-3">
              <input
                type="checkbox"
                checked={onlyLatest}
                onChange={(e) => {
                  setOnlyLatest(e.target.checked);
                  setPage(0);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Doar ultimul ITP pe vehicul
            </label>
            <div className="relative w-full sm:w-72">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Caută după nume, nr. înmatriculare..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Se încarcă...
              </div>
            ) : loadError && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <AlertTriangle size={36} className="opacity-40" />
                <p className="text-sm">Înregistrările nu au putut fi încărcate.</p>
                <button onClick={fetchData} className="text-sm font-medium text-blue-600 hover:underline">
                  Încearcă din nou
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Car size={40} className="opacity-30" />
                <p className="text-sm">
                  {search ? 'Niciun rezultat găsit.' : 'Nu există înregistrări. Adaugă prima înregistrare ITP!'}
                </p>
              </div>
            ) : (
              <>
              {/* Telefon: carduri in loc de tabelul lat */}
              <ul className="md:hidden divide-y divide-slate-100">
                {rows.map((row) => {
                  const border = !row.ultimul
                    ? 'border-l-slate-200'
                    : row.zileRamase < 0
                    ? 'border-l-red-400'
                    : row.zileRamase <= 30
                    ? 'border-l-amber-400'
                    : 'border-l-emerald-400';
                  return (
                    <li key={row.id} className={`px-4 py-3 border-l-4 ${border} ${row.ultimul ? '' : 'opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-semibold text-slate-800">{row.numarInmatriculare}</p>
                          <p className="text-sm font-medium text-slate-700 truncate">{row.numeSofer}</p>
                        </div>
                        <div className="text-sm text-right shrink-0">
                          {row.ultimul ? getDaysTag(row.zileRamase) : <span className="text-xs italic text-slate-400">Reînnoit</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {[row.marca, row.model, row.year ? `(${row.year})` : null].filter(Boolean).join(' ')}
                        {' · '}ITP {row.dataItp} · {row.valabilitateLuni} luni · până la {row.dataUrmatorItp}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(row.status)}
                          {row.contact && (
                            <a href={`tel:${row.contact}`} className="text-xs text-blue-600">
                              {row.contact}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewEntry(row)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Detalii">
                            <Eye size={16} />
                          </button>
                          <Link to={`/fisa/${row.id}`} target="_blank" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Fișa ITP">
                            <Printer size={16} />
                          </Link>
                          <button onClick={() => setEditEntry(row)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Editează">
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={deletingId === row.id}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Șterge"
                          >
                            {deletingId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <table className="hidden md:table min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      '#',
                      'Nume Șofer',
                      'Contact',
                      'Marcă',
                      'VIN',
                      'Nr. Înmatriculare',
                      'Status',
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
                  {rows.map((row, idx) => {
                    const rowCls = row.ultimul ? getRowStyle(row.zileRamase) : 'text-slate-400';
                    return (
                      <tr
                        key={row.id}
                        className={`hover:brightness-95 transition-colors ${rowCls}`}
                      >
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                          {page * PAGE_SIZE + idx + 1}
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(row.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.dataItp}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {row.valabilitateLuni}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {row.dataUrmatorItp}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.ultimul ? (
                            getDaysTag(row.zileRamase)
                          ) : (
                            <span className="text-xs italic">Reînnoit</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewEntry(row)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Detalii"
                            >
                              <Eye size={15} />
                            </button>
                            <Link
                              to={`/fisa/${row.id}`}
                              target="_blank"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Fișa ITP"
                            >
                              <Printer size={15} />
                            </Link>
                            <button
                              onClick={() => setEditEntry(row)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Editează"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span>
                {firstShown}–{lastShown} din {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Înapoi
                </button>
                <span className="tabular-nums">
                  {page + 1} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1 || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Înainte
                </button>
              </div>
            </div>
          )}
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

      {editEntry && (
        <AddItpModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => {
            fetchData();
            showToast('Înregistrarea a fost actualizată.');
          }}
        />
      )}

      {viewEntry && (
        <DetailsModal entry={viewEntry} onClose={() => setViewEntry(null)} />
      )}
    </div>
  );
}
