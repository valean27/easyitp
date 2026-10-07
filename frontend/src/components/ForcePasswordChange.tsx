import { useState } from 'react';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { changePassword } from '../api/accountApi';
import { useAuth } from '../context/auth';
import { apiMessage } from '../utils/errors';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const MIN_LENGTH = 8;

// Prima logare cu o parola data de altcineva (cont de inspector): aplicatia se deschide doar dupa ce o schimba
export default function ForcePasswordChange() {
  const { user, updateUser, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) return setError(`Parola nouă trebuie să aibă cel puțin ${MIN_LENGTH} caractere.`);
    if (next !== confirmPw) return setError('Parolele noi nu coincid.');
    setSaving(true);
    try {
      const token = await changePassword(current, next);
      updateUser({ token, passwordChangeRequired: false });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'Parola actuală este greșită.' : apiMessage(err, 'Parola nu a putut fi schimbată.'));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <KeyRound size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Alegeți parola dumneavoastră</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Contul a fost creat cu o parolă provizorie. Alegeți una a dumneavoastră; o folosiți de acum înainte la logare.
        </p>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Parola provizorie</span>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={INPUT_CLS} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Parola nouă</span>
          <input
            type="password"
            required
            minLength={MIN_LENGTH}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={`Minim ${MIN_LENGTH} caractere`}
            autoComplete="new-password"
            className={INPUT_CLS}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Confirmă parola nouă</span>
          <input type="password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={INPUT_CLS} />
        </label>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Salvează parola
        </button>
        <button type="button" onClick={logout} className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <LogOut size={14} /> Ieșire
        </button>
      </form>
    </div>
  );
}
