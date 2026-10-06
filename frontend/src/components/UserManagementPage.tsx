import { useCallback, useEffect, useState } from 'react';
import {
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  ClipboardCheck,
  Banknote,
  Clock,
  Search,
  Pencil,
  KeyRound,
  Power,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react';
import { SMS_PLANS, planLabel } from '../utils/smsPlans';
import type { ManagerSummary } from '../types';
import { getManagers, setManagerActive, deleteManager, setSmsPlan } from '../api/adminApi';
import { ManagerFormModal, ResetPasswordModal, PlanModal } from './ManagerModals';
import { PLAN_LABELS } from '../utils/plans';

const formatRon = (v: number) =>
  `${v.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} RON`;

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Niciodată';
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Azi';
  if (days === 1) return 'Ieri';
  if (days < 30) return `Acum ${days} zile`;
  return date.toLocaleDateString('ro-RO');
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

interface Banner {
  message: string;
  type: 'success' | 'error';
}

export default function UserManagementPage() {
  const [managers, setManagers] = useState<ManagerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ManagerSummary | null>(null);
  const [resetting, setResetting] = useState<ManagerSummary | null>(null);
  const [planFor, setPlanFor] = useState<ManagerSummary | null>(null);

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    try {
      setManagers(await getManagers());
    } catch {
      setBanner({ message: 'Nu s-a putut încărca lista de manageri.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // Mesajele cu parole raman pe ecran pana sunt inchise manual
  const handleSuccess = (message: string) => {
    setBanner({ message, type: 'success' });
    fetchManagers();
  };

  const handleToggleActive = async (m: ManagerSummary) => {
    const action = m.active ? 'dezactivezi' : 'activezi';
    if (!confirm(`Sigur vrei să ${action} contul ${m.email}?`)) return;
    setBusyId(m.id);
    try {
      await setManagerActive(m.id, !m.active);
      handleSuccess(`Contul ${m.email} a fost ${m.active ? 'dezactivat' : 'activat'}.`);
    } catch {
      setBanner({ message: 'Eroare la schimbarea statusului.', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (m: ManagerSummary) => {
    if (!confirm(`Sigur vrei să ștergi definitiv contul ${m.email}?`)) return;
    setBusyId(m.id);
    try {
      await deleteManager(m.id);
      handleSuccess(`Contul ${m.email} a fost șters.`);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setBanner({
        message:
          status === 409
            ? 'Managerul are înregistrări sau programări. Dezactivează contul în loc să-l ștergi.'
            : 'Eroare la ștergere.',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Butoanele de actiune, comune pentru tabel (desktop) si carduri (telefon)
  const changePlan = async (m: ManagerSummary, plan: number) => {
    try {
      await setSmsPlan(m.id, plan);
      handleSuccess(`Pachetul SMS pentru ${m.stationName ?? m.email}: ${planLabel(plan)}.`);
    } catch {
      alert('Pachetul SMS nu a putut fi salvat.');
    }
  };

  const renderPlan = (m: ManagerSummary) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setPlanFor(m)}
        className={`rounded-lg border px-2 py-1 text-xs font-medium ${
          m.plan === 'FREE' ? 'border-slate-200 text-slate-600' : 'border-blue-200 bg-blue-50 text-blue-700'
        } hover:border-blue-400`}
        title="Abonament"
      >
        {PLAN_LABELS[m.plan]}
        {m.planTrial ? ' · probă' : ''}
        {m.planUntil && m.plan !== 'FREE' ? ` · ${m.planUntil.split('-').reverse().join('.')}` : ''}
        {m.plan === 'FREE' && m.paidPlan && m.paidPlan !== 'FREE' ? ' · expirat' : ''}
      </button>
      <select
        value={m.smsPlan}
        onChange={(e) => changePlan(m, Number(e.target.value))}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        title="Pachet SMS inclus în abonament"
      >
        <option value={0}>Fără pachet</option>
        {SMS_PLANS.map((p) => (
          <option key={p.sms} value={p.sms}>{planLabel(p.sms)}</option>
        ))}
      </select>
      {m.smsPlan > 0 && (
        <span className={`text-xs tabular-nums ${m.smsUsedThisMonth >= m.smsPlan ? 'text-red-600' : 'text-slate-500'}`}>
          {m.smsUsedThisMonth} / {m.smsPlan}
        </span>
      )}
    </div>
  );

  const renderActions = (m: ManagerSummary) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setEditing(m)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        title="Editează stația"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() => setResetting(m)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
        title="Resetează parola"
      >
        <KeyRound size={15} />
      </button>
      <button
        onClick={() => handleToggleActive(m)}
        disabled={busyId === m.id}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          m.active
            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
        }`}
        title={m.active ? 'Dezactivează' : 'Activează'}
      >
        {busyId === m.id ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
      </button>
      <button
        onClick={() => handleDelete(m)}
        disabled={busyId === m.id}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Șterge (doar conturi fără date)"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  const q = search.toLowerCase();
  const filtered = managers.filter(
    (m) =>
      m.email.toLowerCase().includes(q) ||
      (m.stationName ?? '').toLowerCase().includes(q) ||
      (m.address ?? '').toLowerCase().includes(q)
  );

  const activeCount = managers.filter((m) => m.active).length;
  const itpThisMonth = managers.reduce((s, m) => s + m.itpThisMonth, 0);
  const revenueThisMonth = managers.reduce((s, m) => s + m.revenueThisMonth, 0);
  const expiringSoon = managers.reduce((s, m) => s + m.expiringSoonCount, 0);

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Manageri și Stații ITP</h1>
              <p className="text-xs text-slate-400 leading-tight">Situația tuturor stațiilor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchManagers}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Reîncarcă"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <UserPlus size={16} />
              <span className="whitespace-nowrap">
                Adaugă<span className="hidden sm:inline"> Manager</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {banner && (
          <div
            className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 border ${
              banner.type === 'success'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            )}
            <span className="flex-1 break-all">{banner.message}</span>
            <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Stații active"
            value={`${activeCount} / ${managers.length}`}
            icon={<Building2 size={18} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="ITP-uri luna aceasta"
            value={itpThisMonth}
            icon={<ClipboardCheck size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            label="Încasări luna aceasta"
            value={formatRon(revenueThisMonth)}
            icon={<Banknote size={18} className="text-violet-600" />}
            color="bg-violet-50"
          />
          <StatCard
            label="Expiră în 30 zile"
            value={expiringSoon}
            icon={<Clock size={18} className="text-amber-600" />}
            color="bg-amber-50"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              Manageri
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length} din {managers.length})
              </span>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Caută după stație, email, adresă..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && managers.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Se încarcă...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Building2 size={40} className="opacity-30" />
                <p className="text-sm">{search ? 'Niciun rezultat găsit.' : 'Nu există manageri. Adaugă primul manager!'}</p>
              </div>
            ) : (
              <>
              {/* Telefon: carduri in loc de tabelul lat */}
              <ul className="md:hidden divide-y divide-slate-100">
                {filtered.map((m) => (
                  <li key={m.id} className={`px-4 py-3 space-y-2 ${m.active ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {m.stationName || <span className="italic text-slate-400">Fără nume</span>}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                        {m.phone && <p className="text-xs text-slate-500">{m.phone}</p>}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.active ? 'Activ' : 'Dezactivat'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'ITP-uri', value: m.itpCount, cls: 'text-slate-800' },
                        { label: 'Luna', value: m.itpThisMonth, cls: 'text-slate-800' },
                        { label: '≤30 zile', value: m.expiringSoonCount, cls: m.expiringSoonCount > 0 ? 'text-amber-600' : 'text-slate-400' },
                        { label: 'Expirate', value: m.expiredCount, cls: m.expiredCount > 0 ? 'text-red-600' : 'text-slate-400' },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg bg-slate-50 py-1.5">
                          <p className={`text-sm font-semibold ${stat.cls}`}>{stat.value}</p>
                          <p className="text-[11px] text-slate-400">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {renderPlan(m)}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        {formatRon(m.revenueThisMonth)} luna aceasta · logat: {formatLastLogin(m.lastLoginAt).toLowerCase()}
                      </p>
                      {renderActions(m)}
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden md:table min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Stație', 'Contact', 'ITP-uri', 'Luna aceasta', 'Expiră ≤30z', 'Expirate', 'Programări luna', 'Abonament · SMS', 'Ultima logare', 'Status', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((m) => (
                    <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${m.active ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{m.stationName || <span className="italic text-slate-400">Fără nume</span>}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{m.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="whitespace-nowrap">{m.phone || '—'}</div>
                        {m.address && <div className="text-xs text-slate-400 mt-0.5 max-w-56 truncate" title={m.address}>{m.address}</div>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{m.itpCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{m.itpThisMonth} ITP</div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatRon(m.revenueThisMonth)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={m.expiringSoonCount > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                          {m.expiringSoonCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={m.expiredCount > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>{m.expiredCount}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.appointmentsThisMonth}</td>
                      <td className="px-4 py-3">{renderPlan(m)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatLastLogin(m.lastLoginAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {m.active ? 'Activ' : 'Dezactivat'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{renderActions(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 px-1">
          Adminul vede doar cifre agregate; datele clienților rămân private pentru fiecare stație. Un cont dezactivat
          nu se mai poate loga, dar datele lui se păstrează.
        </p>
      </main>

      {showCreate && <ManagerFormModal onClose={() => setShowCreate(false)} onSuccess={handleSuccess} />}
      {editing && <ManagerFormModal manager={editing} onClose={() => setEditing(null)} onSuccess={handleSuccess} />}
      {planFor && <PlanModal manager={planFor} onClose={() => setPlanFor(null)} onSuccess={handleSuccess} />}
      {resetting && <ResetPasswordModal manager={resetting} onClose={() => setResetting(null)} onSuccess={handleSuccess} />}
    </div>
  );
}
