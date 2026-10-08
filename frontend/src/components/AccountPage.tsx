import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCog, Building2, KeyRound, Palette, Loader2, CheckCircle2, AlertTriangle, MessageSquareText, RotateCcw, LogOut, HardHat, BookOpen } from 'lucide-react';
import { getProfile, updateProfile, changePassword, getInspectors } from '../api/accountApi';
import { useAuth } from '../context/auth';
import BookingSettingsCard from './BookingSettingsCard';
import LinesCard from './LinesCard';
import LogoUploader from './LogoUploader';
import ThemeSwitcher from './ThemeSwitcher';
import SettingsCard from './SettingsCard';
import DigestCard from './DigestCard';
import AutoSmsCard from './AutoSmsCard';
import VisibilityCard from './VisibilityCard';
import StationDeadlinesCard from './StationDeadlinesCard';
import InvoicingCard from './InvoicingCard';
import SubscriptionCard from './SubscriptionCard';
import AccountDataCard from './AccountDataCard';
import { bookingUrl } from '../utils/booking';
import { DEFAULT_REMINDER_TEMPLATE, TEMPLATE_PLACEHOLDERS, renderReminder } from '../utils/reminderMessage';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

type Message = { text: string; type: 'success' | 'error' } | null;

function MessageBox({ message }: { message: Message }) {
  if (!message) return null;
  const ok = message.type === 'success';
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
        ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
      }`}
    >
      {ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
      {message.text}
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {label}
    </button>
  );
}

function Card({ id, icon, title, summary, children }: { id?: string; icon: React.ReactNode; title: string; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SettingsCard id={id} icon={icon} title={title} summary={summary}>
      <div className="px-6 py-5">{children}</div>
    </SettingsCard>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function StationCard({ bookingLink }: { bookingLink: string | null }) {
  const { updateUser } = useAuth();
  const [stationName, setStationName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setStationName(p.stationName ?? '');
        setAddress(p.address ?? '');
        setPhone(p.phone ?? '');
        setTemplate(p.reminderTemplate || DEFAULT_REMINDER_TEMPLATE);
        setLogoUrl(p.logoUrl ?? null);
      })
      .catch(() => setMessage({ text: 'Nu s-au putut încărca datele stației.', type: 'error' }))
      .finally(() => setLoaded(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      // Mesajul implicit nu se salveaza, ca eventualele imbunatatiri viitoare sa ajunga automat la toti
      const custom = template.trim() === DEFAULT_REMINDER_TEMPLATE ? null : template;
      const p = await updateProfile({ stationName, address, phone, reminderTemplate: custom });
      updateUser({ stationName: p.stationName });
      setMessage({ text: 'Datele stației au fost salvate.', type: 'success' });
    } catch {
      setMessage({ text: 'Eroare la salvare.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card id="statie" icon={<Building2 size={15} />} title="Date stație ITP" summary={loaded ? stationName || 'Necompletat' : undefined}>
      {!loaded ? (
        <div className="flex items-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <LogoUploader logoUrl={logoUrl} onChange={setLogoUrl} />
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1">Nume stație</span>
            <input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="ITP Auto Center" className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1">Adresă</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Str. Exemplu nr. 1" className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1">Telefon stație</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" className={INPUT_CLS} />
          </label>
          <div>
            <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1">
              <label htmlFor="reminder-template" className="flex items-center gap-1.5">
                <MessageSquareText size={14} /> Mesaj de reamintire ITP
              </label>
              {template !== DEFAULT_REMINDER_TEMPLATE && (
                <button
                  type="button"
                  onClick={() => setTemplate(DEFAULT_REMINDER_TEMPLATE)}
                  className="flex items-center gap-1 text-xs font-normal text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw size={12} /> Mesajul implicit
                </button>
              )}
            </div>
            <textarea id="reminder-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className={INPUT_CLS + ' resize-y'} />
            <p className="text-xs text-slate-400 mt-1">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <span key={p.key} className="inline-block mr-2" title={p.description}>
                  <code className="text-slate-500">{p.key}</code>
                </span>
              ))}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Propozițiile cu informații lipsă (de ex. stație fără adresă) sunt omise automat.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Previzualizare</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 whitespace-pre-wrap">
              {renderReminder(template, {
                nume: 'Ion Popescu',
                numar: 'CJ 01 ABC',
                masina: 'Dacia Logan',
                dataExpirare: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
                expirat: false,
                statie: stationName,
                adresa: address,
                telefon: phone,
                link: bookingLink,
                stop: `${window.location.origin}/stop/…`,
              })}
            </p>
          </div>
          <MessageBox message={message} />
          <SubmitButton loading={loading} label="Salvează" />
        </form>
      )}
    </Card>
  );
}

// Inspectorii statiei: echipa se gestioneaza pe pagina /inspectori (culoare, linie, atestat, dashboard)
function InspectorsCard() {
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    getInspectors()
      .then(setNames)
      .catch(() => setNames([]));
  }, []);

  return (
    <Card
      id="inspectori"
      icon={<HardHat size={15} />}
      title="Inspectori"
      summary={names && (names.length === 0 ? 'Niciun inspector' : names.length === 1 ? names[0] : `${names.length} inspectori`)}
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Echipa stației: fiecare inspector are culoarea lui, linia pe care lucrează de obicei și atestatul. Îi alegeți la ITP și pe programări,
          iar pe pagina Inspectori vedeți cât a lucrat fiecare. Nu au nevoie de cont.
        </p>
        {names === null ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : (
          names.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {names.map((name) => (
                <li key={name} className="px-3 py-1 rounded-full bg-slate-100 text-sm text-slate-700">
                  {name}
                </li>
              ))}
            </ul>
          )
        )}
        <Link
          to="/inspectori"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <HardHat size={14} /> Gestionează inspectorii
        </Link>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const { updateUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next !== confirmPw) {
      setMessage({ text: 'Parolele noi nu coincid.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      updateUser({ token: await changePassword(current, next) });
      setCurrent('');
      setNext('');
      setConfirmPw('');
      setMessage({ text: 'Parola a fost schimbată. Celelalte dispozitive au fost delogate.', type: 'success' });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({
        text: status === 403 ? 'Parola curentă este greșită.' : 'Eroare la schimbarea parolei.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card icon={<KeyRound size={15} />} title="Schimbă parola">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Parola curentă</span>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={INPUT_CLS} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Parola nouă</span>
          <input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Minim 6 caractere" autoComplete="new-password" className={INPUT_CLS} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Confirmă parola nouă</span>
          <input type="password" required minLength={6} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={INPUT_CLS} />
        </label>
        <MessageBox message={message} />
        <SubmitButton loading={loading} label="Schimbă parola" />
      </form>
    </Card>
  );
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bookingLink, setBookingLink] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <UserCog size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight">Contul meu</h1>
            <p className="text-xs text-slate-400 leading-tight truncate">{user?.email}</p>
          </div>
          {/* Pe telefon nu exista meniul lateral: ghidul si deconectarea sunt aici */}
          {user?.role === 'MANAGER' && (
            <Link
              to="/ghid"
              className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              <BookOpen size={15} />
              Ghid
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} />
            Ieșire
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-5xl items-start">
          {user?.role === 'MANAGER' && (
            <Group title="Stația">
              <StationCard bookingLink={bookingLink} />
              <LinesCard />
              <BookingSettingsCard onChange={(s) => setBookingLink(s.enabled && s.slug ? bookingUrl(s.slug) : null)} />
              <InspectorsCard />
              <StationDeadlinesCard />
              <InvoicingCard />
            </Group>
          )}
          <div className="space-y-6">
            {user?.role === 'MANAGER' && (
              <Group title="Abonament">
                <SubscriptionCard />
              </Group>
            )}
            {user?.role === 'MANAGER' && (
              <Group title="Mesaje către clienți">
                <AutoSmsCard />
                <VisibilityCard />
              </Group>
            )}
            <Group title="Contul tău">
              {user?.role === 'MANAGER' && <DigestCard />}
              <Card icon={<Palette size={15} />} title="Aspect">
                <ThemeSwitcher />
              </Card>
              <PasswordCard />
              {user?.role === 'MANAGER' && <AccountDataCard />}
            </Group>
          </div>
        </div>
      </main>
    </div>
  );
}
