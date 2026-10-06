import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  RefreshCw,
  Search,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  Copy,
  Check,
  CalendarCheck,
  UserX,
  PhoneOutgoing,
  RotateCcw,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';
import type { DeadlineReminder, Profile, Reminder, ReminderStatus } from '../types';
import { getDeadlineReminders, getReminders, setDeadlineContacted, updateReminderStatus } from '../api/reminderApi';
import DeadlineReminderList from './DeadlineReminderList';
import { getProfile } from '../api/accountApi';
import { normalizePhone, renderReminder, smsLink, stopUrl, whatsappLink } from '../utils/reminderMessage';
import AppointmentModal from './AppointmentModal';
import { bookingUrl } from '../utils/booking';
import { formatTime } from '../utils/dates';

type StatusTab = 'TODO' | ReminderStatus | 'ALL';
type Urgency = 'ALL' | '7' | '14' | '30' | 'EXPIRED';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'TODO', label: 'De contactat' },
  { key: 'CONTACTED', label: 'Contactați' },
  { key: 'SCHEDULED', label: 'Programați' },
  { key: 'NOT_INTERESTED', label: 'Neinteresați' },
  { key: 'ALL', label: 'Toate' },
];

const URGENCY_CHIPS: { key: Urgency; label: string }[] = [
  { key: 'ALL', label: 'Toate' },
  { key: '7', label: '≤ 7 zile' },
  { key: '14', label: '≤ 14 zile' },
  { key: '30', label: '≤ 30 zile' },
  { key: 'EXPIRED', label: 'Expirate' },
];

const STATUS_BADGE: Record<ReminderStatus, { label: string; cls: string }> = {
  CONTACTED: { label: 'Contactat', cls: 'bg-blue-100 text-blue-700' },
  SCHEDULED: { label: 'Programat', cls: 'bg-emerald-100 text-emerald-700' },
  NOT_INTERESTED: { label: 'Neinteresat', cls: 'bg-slate-200 text-slate-600' },
};

function matchesTab(r: Reminder, tab: StatusTab): boolean {
  if (tab === 'ALL') return true;
  if (tab === 'TODO') return r.reminderStatus === null;
  return r.reminderStatus === tab;
}

function matchesUrgency(r: Reminder, urgency: Urgency): boolean {
  if (urgency === 'ALL') return true;
  if (urgency === 'EXPIRED') return r.zileRamase < 0;
  return r.zileRamase >= 0 && r.zileRamase <= Number(urgency);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'azi';
  if (days === 1) return 'ieri';
  return `acum ${days} zile`;
}

function ExpiryBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertTriangle size={12} />
        Expirat de {Math.abs(days)} {Math.abs(days) === 1 ? 'zi' : 'zile'}
      </span>
    );
  }
  const cls = days <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Clock size={12} />
      {days === 0 ? 'Expiră azi' : `Expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`}
    </span>
  );
}

const ACTION_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none';

function ReminderCard({
  reminder,
  profile,
  onStatus,
  onSchedule,
  busy,
}: {
  reminder: Reminder;
  profile: Profile | null;
  onStatus: (r: Reminder, status: ReminderStatus | null) => void;
  onSchedule: (r: Reminder) => void;
  busy: boolean;
}) {
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const phone = normalizePhone(reminder.contact);
  const message = renderReminder(profile?.reminderTemplate, {
    nume: reminder.numeSofer,
    numar: reminder.numarInmatriculare,
    masina: [reminder.marca, reminder.model].filter(Boolean).join(' '),
    dataExpirare: reminder.dataUrmatorItp,
    expirat: reminder.zileRamase < 0,
    statie: profile?.stationName ?? null,
    adresa: profile?.address ?? null,
    telefon: profile?.phone ?? null,
    link: profile?.bookingEnabled && profile.bookingSlug ? bookingUrl(profile.bookingSlug) : null,
    stop: reminder.stopToken ? stopUrl(reminder.stopToken) : null,
  });

  // Deschiderea WhatsApp/SMS marcheaza automat clientul ca "Contactat"
  const markContacted = () => {
    if (reminder.reminderStatus === null) onStatus(reminder, 'CONTACTED');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowMessage(true);
    }
  };

  const status = reminder.reminderStatus;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-slate-800">{reminder.numarInmatriculare}</span>
            <ExpiryBadge days={reminder.zileRamase} />
            {status && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status].cls}`}>
                {STATUS_BADGE[status].label} {formatAgo(reminder.reminderAt)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-1">
            <span className="font-medium">{reminder.numeSofer}</span>
            <span className="text-slate-400"> · {[reminder.marca, reminder.model].filter(Boolean).join(' ')}</span>
            {reminder.autoSmsAt && (
              <span className="ml-2 inline-flex px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 align-middle">
                SMS automat {formatDate(reminder.autoSmsAt.slice(0, 10))}
              </span>
            )}
            {reminder.consent !== 'GIVEN' && (
              <span
                className="ml-2 inline-flex px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-medium text-slate-500 align-middle"
                title="Nu avem acordul înregistrat al clientului pentru mesaje. Îl puteți bifa la următorul ITP sau din fișa clientului."
              >
                fără acord
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            ITP valabil până la {formatDate(reminder.dataUrmatorItp)} · {reminder.contact || 'fără telefon'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={phone ? whatsappLink(phone, message) : undefined}
          target="_blank"
          rel="noreferrer"
          onClick={markContacted}
          aria-disabled={!phone}
          className={`${ACTION_BTN} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${phone ? '' : 'opacity-40 pointer-events-none'}`}
        >
          <MessageCircle size={14} />
          WhatsApp
        </a>
        <a
          href={phone ? smsLink(phone, message) : undefined}
          onClick={markContacted}
          aria-disabled={!phone}
          className={`${ACTION_BTN} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 ${phone ? '' : 'opacity-40 pointer-events-none'}`}
        >
          <MessageSquare size={14} />
          SMS
        </a>
        <a
          href={phone ? `tel:+${phone}` : undefined}
          onClick={markContacted}
          aria-disabled={!phone}
          className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 ${phone ? '' : 'opacity-40 pointer-events-none'}`}
        >
          <Phone size={14} />
          Sună
        </a>
        <button onClick={handleCopy} className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          {copied ? 'Copiat' : 'Copiază mesajul'}
        </button>
        <button
          onClick={() => setShowMessage((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          {showMessage ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Mesaj
        </button>
      </div>

      {showMessage && (
        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">{message}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-50">
        <span className="text-xs text-slate-400 mr-1">Marchează:</span>
        <button
          disabled={busy || status === 'CONTACTED'}
          onClick={() => onStatus(reminder, 'CONTACTED')}
          className={`${ACTION_BTN} border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700`}
        >
          <PhoneOutgoing size={13} />
          Contactat
        </button>
        <button
          disabled={busy}
          onClick={() => onSchedule(reminder)}
          className={`${ACTION_BTN} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          title="Creează programarea în calendar și marchează clientul ca Programat"
        >
          <CalendarCheck size={13} />
          Programează
        </button>
        <button
          disabled={busy || status === 'NOT_INTERESTED'}
          onClick={() => onStatus(reminder, 'NOT_INTERESTED')}
          className={`${ACTION_BTN} border-slate-200 text-slate-600 hover:bg-slate-100`}
        >
          <UserX size={13} />
          Neinteresat
        </button>
        {status && (
          <button
            disabled={busy}
            onClick={() => onStatus(reminder, null)}
            className={`${ACTION_BTN} border-transparent text-slate-400 hover:text-slate-600`}
            title="Mută înapoi la De contactat"
          >
            <RotateCcw size={13} />
            Resetează
          </button>
        )}
        {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>('TODO');
  // ?urgenta=expirate vine din cardul „Expirat” de pe dashboard
  const [urgency, setUrgency] = useState<Urgency>(() =>
    new URLSearchParams(window.location.search).get('urgenta') === 'expirate' ? 'EXPIRED' : 'ALL',
  );
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [scheduling, setScheduling] = useState<Reminder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // ITP-uri sau alte scadente (RCA, rovinieta, tahograf)
  const [view, setView] = useState<'ITP' | 'OTHER'>('ITP');
  const [deadlines, setDeadlines] = useState<DeadlineReminder[]>([]);
  const [busyDeadline, setBusyDeadline] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, me, other] = await Promise.all([getReminders(), getProfile(), getDeadlineReminders()]);
      setReminders(rows);
      setProfile(me);
      setDeadlines(other);
    } catch {
      setError('Nu s-a putut încărca lista.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatus = async (r: Reminder, status: ReminderStatus | null) => {
    const previous = reminders;
    setBusyId(r.id);
    setReminders((list) =>
      list.map((x) => (x.id === r.id ? { ...x, reminderStatus: status, reminderAt: status ? new Date().toISOString() : null } : x))
    );
    try {
      await updateReminderStatus(r.id, status);
    } catch {
      setReminders(previous);
      setError('Statusul nu a putut fi salvat.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeadline = async (d: DeadlineReminder, contacted: boolean) => {
    const key = `${d.vehicleId}-${d.kind}`;
    const previous = deadlines;
    setBusyDeadline(key);
    setDeadlines((list) =>
      list.map((x) =>
        x.vehicleId === d.vehicleId && x.kind === d.kind ? { ...x, contactedAt: contacted ? new Date().toISOString() : null } : x
      )
    );
    try {
      await setDeadlineContacted(d.vehicleId, d.kind, contacted);
    } catch {
      setDeadlines(previous);
      setError('Statusul nu a putut fi salvat.');
    } finally {
      setBusyDeadline(null);
    }
  };

  const qd = search.toLowerCase();
  const visibleDeadlines = deadlines
    .filter((d) => d.clientName.toLowerCase().includes(qd) || d.plate.toLowerCase().includes(qd) || (d.phone ?? '').includes(qd))
    .sort((a, b) => Number(!!a.contactedAt) - Number(!!b.contactedAt) || a.daysLeft - b.daysLeft);
  const deadlinesTodo = deadlines.filter((d) => !d.contactedAt).length;

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { TODO: 0, CONTACTED: 0, SCHEDULED: 0, NOT_INTERESTED: 0, ALL: reminders.length };
    reminders.forEach((r) => {
      c[r.reminderStatus ?? 'TODO']++;
    });
    return c;
  }, [reminders]);

  const q = search.toLowerCase();
  const visible = reminders
    .filter((r) => matchesTab(r, tab) && matchesUrgency(r, urgency))
    .filter(
      (r) =>
        r.numeSofer.toLowerCase().includes(q) ||
        r.numarInmatriculare.toLowerCase().includes(q) ||
        (r.contact ?? '').includes(q)
    )
    .sort((a, b) => a.zileRamase - b.zileRamase);

  const missingStationInfo = profile && profile.role === 'MANAGER' && (!profile.stationName || !profile.phone);

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BellRing size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">De contactat</h1>
              <p className="text-xs text-slate-400 leading-tight hidden sm:block">
                ITP-uri, RCA, roviniete și tahografe care expiră curând
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Reîncarcă"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {missingStationInfo && (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Completați numele și telefonul stației în{' '}
              <Link to="/account" className="font-semibold underline">
                Contul meu
              </Link>{' '}
              ca să apară în mesajele către clienți.
            </span>
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CalendarCheck size={16} className="shrink-0" />
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100">
              Închide
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-xs opacity-60 hover:opacity-100">
              Închide
            </button>
          </div>
        )}

        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {([
            ['ITP', 'ITP', counts.TODO],
            ['OTHER', 'RCA, rovinietă, tahograf', deadlinesTodo],
          ] as const).map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
              {n > 0 && <span className="ml-1.5 text-xs text-blue-600">{n}</span>}
            </button>
          ))}
        </div>

        {view === 'OTHER' ? (
          <>
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Caută după nume, număr, telefon..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {loading && deadlines.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Se încarcă...
              </div>
            ) : (
              <DeadlineReminderList items={visibleDeadlines} profile={profile} busyKey={busyDeadline} onContacted={handleDeadline} />
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-100' : 'text-slate-400'}`}>{counts[t.key]}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {URGENCY_CHIPS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setUrgency(c.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      urgency === c.key ? 'bg-slate-800 text-white dark:text-slate-50' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Caută după nume, număr, telefon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {loading && reminders.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Se încarcă...
              </div>
            ) : error && reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <p className="text-sm">Lista nu a putut fi încărcată.</p>
                <button onClick={fetchData} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Încearcă din nou
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Inbox size={40} className="opacity-30" />
                <p className="text-sm">
                  {tab === 'TODO' && reminders.length > 0 && !search && urgency === 'ALL'
                    ? 'Ați contactat pe toată lumea. Bravo!'
                    : 'Niciun client în această listă.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visible.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    profile={profile}
                    onStatus={handleStatus}
                    onSchedule={setScheduling}
                    busy={busyId === r.id}
                  />
                ))}
              </div>
            )}

          </>
        )}

        {scheduling && (
          <AppointmentModal
            initial={{
              clientName: scheduling.numeSofer,
              phone: scheduling.contact ?? '',
              licensePlate: scheduling.numarInmatriculare,
            }}
            onClose={() => setScheduling(null)}
            onSaved={(appt) => {
              handleStatus(scheduling, 'SCHEDULED');
              const [y, m, d] = appt.appointmentDate.slice(0, 10).split('-');
              setNotice(`${scheduling.numeSofer} a fost programat pe ${d}.${m}.${y} la ${formatTime(appt.appointmentDate)}.`);
            }}
          />
        )}

        <p className="text-xs text-slate-400 px-1">
          Apăsarea pe WhatsApp, SMS sau Sună marchează automat clientul ca „Contactat”. Clientul dispare din listă când
          adaugi noul lui ITP.
        </p>
      </main>
    </div>
  );
}
