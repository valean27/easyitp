import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axiosInstance';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/auth';
import { usePageTitle } from '../utils/pageTitle';

export default function LoginPage() {
  usePageTitle('Autentificare');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowServer, setSlowServer] = useState(false);
  // mesaj de dupa o actiune care delogheaza (ex. stergerea contului)
  const [params] = useSearchParams();
  const info = params.get('info');

  // Serverul gratuit (Render) adoarme; il trezim cat timp utilizatorul completeaza formularul
  useEffect(() => {
    api.get('/api/health').catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const slowTimer = setTimeout(() => setSlowServer(true), 4000);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Email sau parolă incorecte.');
      } else if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError('Prea multe încercări greșite. Încercați din nou peste 15 minute.');
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError('Contul este dezactivat. Contactați administratorul.');
      } else {
        setError('Serverul nu răspunde. Încercați din nou în câteva secunde.');
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowServer(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 py-8">
      {/* Inapoi la pagina de prezentare (vizitatorii nelogati o vad pe "/") */}
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Înapoi la pagina principală
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        <Link to="/" className="flex flex-col items-center gap-2" title="Pagina principală">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Car size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">EasyITP</h1>
          <p className="text-sm text-slate-500">Autentificați-vă pentru a continua</p>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@example.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm font-medium text-slate-600">
                Parolă
              </label>
              <Link to="/parola-uitata" className="text-xs font-medium text-blue-600 hover:underline">
                Ați uitat parola?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {info && !error && (
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{info}</div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {slowServer && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Loader2 size={14} className="shrink-0 animate-spin" />
              Serverul pornește, poate dura până la un minut...
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Autentificare
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Nu aveți cont?{' '}
          <Link to="/inregistrare" className="font-semibold text-blue-600 hover:underline">
            Înscrieți stația, 14 zile gratuit
          </Link>
        </p>
      </div>
    </div>
  );
}
