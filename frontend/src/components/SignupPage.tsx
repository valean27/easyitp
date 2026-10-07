import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/auth';
import { apiMessage } from '../utils/errors';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';
import { TRIAL_DAYS } from '../utils/plans';
import { usePageTitle } from '../utils/pageTitle';

const NAV = [
  { href: '/#functionalitati', label: 'Funcționalități' },
  { href: '/#preturi', label: 'Prețuri' },
  { href: '/statii', label: 'Stații ITP' },
];

type Field = 'stationName' | 'city' | 'phone' | 'email' | 'password' | 'acceptTerms';

const INPUT =
  'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Inscrierea unei statii noi: cont de manager cu proba Premium, intra direct in aplicatie
export default function SignupPage() {
  usePageTitle('Înscrieți stația ITP, 14 zile gratuit');
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ stationName: '', city: '', phone: '', email: '', password: '', website: '' });
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<Field | null>(null);

  // trezim serverul (Render) cat timp se completeaza formularul
  useEffect(() => {
    api.get('/api/health').catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (field === k) setField(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setField(null);
    setLoading(true);
    try {
      await signup({ ...form, acceptTerms: accept });
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiMessage(err, 'Serverul nu răspunde. Încercați din nou în câteva secunde.'));
      if (axios.isAxiosError(err)) {
        const f = (err.response?.data as { field?: Field } | undefined)?.field;
        setField(f ?? (err.response?.status === 409 ? 'email' : null));
      }
    } finally {
      setLoading(false);
    }
  };

  const cls = (k: Field) => `${INPUT} ${field === k ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'}`;

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col">
      <PublicHeader links={NAV} />
      <main className="flex-1 bg-gradient-to-b from-blue-50 to-transparent dark:from-[#10213f]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Înscriere</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Încercați Easy ITP {TRIAL_DAYS} zile, cu tot inclus</h1>
            <p className="mt-4 text-slate-600">
              Contul e gata într-un minut. În perioada de probă aveți pachetul Premium; la final alegeți pachetul sau
              rămâneți pe Gratuit, fără să pierdeți datele.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              {[
                'Fără card la înscriere',
                'Importați clienții din Excel sau din aplicația veche',
                'SMS-uri automate de pe telefonul stației',
                'Programare online: linkul îl dați clienților și, dacă vreți, îl puneți pe Google Maps sau Facebook',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 size={17} className="text-emerald-600 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Numele stației</span>
              <input className={cls('stationName')} value={form.stationName} onChange={set('stationName')} placeholder="ITP Exemplu" autoComplete="organization" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Oraș</span>
                <input className={cls('city')} value={form.city} onChange={set('city')} placeholder="Baia Mare" autoComplete="address-level2" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Telefon</span>
                <input className={cls('phone')} value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" inputMode="tel" autoComplete="tel" />
              </label>
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Email (pentru logare)</span>
              <input className={cls('email')} type="email" value={form.email} onChange={set('email')} placeholder="statie@exemplu.ro" autoComplete="email" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Parolă</span>
              <input className={cls('password')} type="password" value={form.password} onChange={set('password')} placeholder="minim 8 caractere" autoComplete="new-password" />
            </label>
            {/* capcana pentru boti: oamenii nu o vad */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={set('website')}
              className="hidden"
              aria-hidden="true"
              name="website"
            />
            <label className={`flex items-start gap-2 text-sm ${field === 'acceptTerms' ? 'text-red-600' : 'text-slate-600'}`}>
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => {
                  setAccept(e.target.checked);
                  if (field === 'acceptTerms') setField(null);
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Am citit și accept{' '}
                <Link to="/termeni" target="_blank" className="font-semibold text-blue-600 hover:underline">termenii</Link> și{' '}
                <Link to="/confidentialitate" target="_blank" className="font-semibold text-blue-600 hover:underline">politica de confidențialitate</Link>.
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Creează contul
            </button>
            <p className="text-center text-sm text-slate-500">
              Aveți deja cont?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:underline">Intrați în cont</Link>
            </p>
          </form>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
