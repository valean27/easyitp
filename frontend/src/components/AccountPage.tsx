import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCog, Building2, KeyRound, Palette, Loader2, CheckCircle2, AlertTriangle, MessageSquareText, RotateCcw, LogOut, HardHat, X, Plus } from 'lucide-react';
import { getProfile, updateProfile, changePassword, getInspectors, updateInspectors } from '../api/accountApi';
import { useAuth } from '../context/auth';
import BookingSettingsCard from './BookingSettingsCard';
import ThemeSwitcher from './ThemeSwitcher';
import SettingsCard from './SettingsCard';
import DigestCard from './DigestCard';
import AutoSmsCard from './AutoSmsCard';
import VisibilityCard from './VisibilityCard';
import StationDeadlinesCard from './StationDeadlinesCard';
import InvoicingCard from './InvoicingCard';
import SubscriptionCard from './SubscriptionCard';
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

function Card({ icon, title, summary, children }: { icon: React.ReactNode; title: string; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SettingsCard icon={icon} title={title} summary={summary}>
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
    <Card icon={<Building2 size={15} />} title="Date stație ITP" summary={loaded ? stationName || 'Necompletat' : undefined}>
      {!loaded ? (
        <div className="flex items-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nume stație</label>
            <input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="ITP Auto Center" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Adresă</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Str. Exemplu nr. 1" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Telefon stație</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" className={INPUT_CLS} />
          </div>
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1">
              <span className="flex items-center gap-1.5">
                <MessageSquareText size={14} /> Mesaj de reamintire ITP
              </span>
              {template !== DEFAULT_REMINDER_TEMPLATE && (
                <button
                  type="button"
                  onClick={() => setTemplate(DEFAULT_REMINDER_TEMPLATE)}
                  className="flex items-center gap-1 text-xs font-normal text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw size={12} /> Mesajul implicit
                </button>
              )}
            </label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className={INPUT_CLS + ' resize-y'} />
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

// Inspectorii statiei: doar nume, alese in formularul ITP; rapoartele arata cate verificari a facut fiecare
function InspectorsCard() {
  const [names, setNames] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getInspectors()
      .then(setNames)
      .catch(() => setMessage({ text: 'Lista nu a putut fi încărcată.', type: 'error' }));
  }, []);

  const save = async (next: string[]) => {
    setSaving(true);
    setMessage(null);
    try {
      setNames(await updateInspectors(next));
    } catch {
      setMessage({ text: 'Lista nu a putut fi salvată.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || !names) return;
    setDraft('');
    save([...names, name]);
  };

  return (
    <Card
      icon={<HardHat size={15} />}
      title="Inspectori"
      summary={names && (names.length === 0 ? 'Niciun inspector' : names.length === 1 ? names[0] : `${names.length} inspectori`)}
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          La fiecare ITP alegi cine a făcut verificarea, iar în Rapoarte vezi câte verificări și câte respingeri are fiecare.
          Nu au nevoie de cont.
        </p>
        {names === null ? (
          message ? <MessageBox message={message} /> : <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : (
          <>
            {names.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {names.map((name) => (
                  <li key={name} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-slate-100 text-sm text-slate-700">
                    {name}
                    <button
                      type="button"
                      onClick={() => save(names.filter((n) => n !== name))}
                      disabled={saving}
                      aria-label={`Șterge ${name}`}
                      className="p-1 rounded-full text-slate-400 hover:text-red-600 hover:bg-white"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAdd} className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} placeholder="Nume inspector" className={INPUT_CLS} />
              <button
                type="submit"
                disabled={saving || !draft.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Adaugă
              </button>
            </form>
            <MessageBox message={message} />
          </>
        )}
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
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Parola curentă</label>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Parola nouă</label>
          <input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Minim 6 caractere" autoComplete="new-password" className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Confirmă parola nouă</label>
          <input type="password" required minLength={6} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={INPUT_CLS} />
        </div>
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
          {/* Pe telefon nu exista meniul lateral cu butonul de deconectare */}
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
            </Group>
          </div>
        </div>
      </main>
    </div>
  );
}
