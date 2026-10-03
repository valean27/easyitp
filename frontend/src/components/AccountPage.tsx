import { useEffect, useState } from 'react';
import { UserCog, Building2, KeyRound, Loader2, CheckCircle2, AlertTriangle, MessageSquareText, RotateCcw } from 'lucide-react';
import { getProfile, updateProfile, changePassword } from '../api/accountApi';
import { useAuth } from '../context/auth';
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

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function StationCard() {
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
    <Card icon={<Building2 size={15} className="text-blue-600" />} title="Date Stație ITP">
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

function PasswordCard() {
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
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmPw('');
      setMessage({ text: 'Parola a fost schimbată.', type: 'success' });
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
    <Card icon={<KeyRound size={15} className="text-blue-600" />} title="Schimbă Parola">
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
  const { user } = useAuth();

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <UserCog size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">Contul meu</h1>
            <p className="text-xs text-slate-400 leading-tight">{user?.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
          {user?.role === 'MANAGER' && <StationCard />}
          <PasswordCard />
        </div>
      </main>
    </div>
  );
}
