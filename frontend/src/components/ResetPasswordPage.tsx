import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { resetPassword } from '../api/authApi';
import { apiMessage } from '../utils/errors';
import { useAuth } from '../context/auth';
import AuthCard, { AUTH_INPUT, AuthMessage } from './AuthCard';

const MIN_LENGTH = 8;

// Linkul din emailul "Am uitat parola" (/resetare-parola?token=...): parola noua, apoi login
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) return setError(`Parola trebuie să aibă minim ${MIN_LENGTH} caractere.`);
    if (password !== confirm) return setError('Parolele nu coincid.');
    setLoading(true);
    try {
      const message = await resetPassword(token, password);
      // sesiunile vechi nu mai sunt valabile, inclusiv una deschisa in acest browser
      logout();
      setDone(message);
    } catch (err) {
      setError(apiMessage(err, 'Parola nu a putut fi schimbată. Încercați din nou.'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Link incomplet">
        <AuthMessage type="error" text="Linkul de resetare nu este complet. Deschideți-l din email sau cereți altul." />
        <Link to="/parola-uitata" className="block text-center text-sm font-semibold text-blue-600 hover:underline">
          Cere un link nou
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Alegeți parola nouă">
      {done ? (
        <div className="space-y-4">
          <AuthMessage type="success" text={done} />
          <Link to="/login" className="block w-full text-center py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Intră în cont
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1">Parola nouă</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`minim ${MIN_LENGTH} caractere`}
              autoComplete="new-password"
              className={AUTH_INPUT}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1">Repetați parola</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={AUTH_INPUT} />
          </label>
          {error && <AuthMessage type="error" text={error} />}
          {error?.includes('nu mai este valabil') && (
            <Link to="/parola-uitata" className="block text-center text-sm font-semibold text-blue-600 hover:underline">
              Cere un link nou
            </Link>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Salvează parola
          </button>
        </form>
      )}
    </AuthCard>
  );
}
