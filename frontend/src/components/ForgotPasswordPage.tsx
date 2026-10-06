import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { forgotPassword } from '../api/authApi';
import { apiMessage } from '../utils/errors';
import AuthCard, { AUTH_INPUT, AuthMessage } from './AuthCard';
import { usePageTitle } from '../utils/pageTitle';

// "Am uitat parola": trimite pe email linkul de resetare (acelasi raspuns si daca adresa nu are cont)
export default function ForgotPasswordPage() {
  usePageTitle('Parolă uitată');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      setMessage({ type: 'success', text: await forgotPassword(email) });
    } catch (err) {
      setMessage({ type: 'error', text: apiMessage(err, 'Serverul nu răspunde. Încercați din nou în câteva secunde.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Ați uitat parola?" subtitle="Vă trimitem pe email un link pentru o parolă nouă.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1">Emailul contului</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="statie@exemplu.ro"
            autoComplete="email"
            className={AUTH_INPUT}
          />
        </label>
        {message && <AuthMessage type={message.type} text={message.text} />}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Trimite linkul
        </button>
      </form>
    </AuthCard>
  );
}
