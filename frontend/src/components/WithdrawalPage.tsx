import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { submitWithdrawal } from '../api/publicApi';
import { apiMessage } from '../utils/errors';
import { usePageTitle } from '../utils/pageTitle';
import { COMPANY } from '../utils/company';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';

const NAV = [
  { href: '/', label: 'Pentru stații ITP' },
  { href: '/termeni', label: 'Termeni' },
];

type Field = 'name' | 'email' | 'contract';

const INPUT =
  'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Functia de retragere din contract (OUG 34/2014 art. 11^1): mereu accesibila din subsol; clientul spune cine este si ce
// contract, confirma, iar confirmarea de primire ii vine pe email
export default function WithdrawalPage() {
  usePageTitle('Retragere din contract');
  const [form, setForm] = useState({ name: '', email: '', contract: '', message: '', website: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<Field | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (field === k) setField(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setDone(await submitWithdrawal(form));
    } catch (err) {
      setError(apiMessage(err, 'Cererea nu a putut fi trimisă. Încercați din nou sau scrieți-ne pe email.'));
      if (axios.isAxiosError(err)) setField((err.response?.data as { field?: Field } | undefined)?.field ?? null);
    } finally {
      setLoading(false);
    }
  };

  const cls = (k: Field) => `${INPUT} ${field === k ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'}`;

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col">
      <PublicHeader links={NAV} />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Retragere din contract</h1>
          <p className="mt-3 text-slate-600">
            Completați formularul și apăsați „Confirmați retragerea”. Primiți imediat pe email confirmarea primirii, cu data și ora.
            Nu trebuie să spuneți motivul. Detalii despre rambursare găsiți în{' '}
            <Link to="/termeni#anulare" className="font-semibold text-blue-600 hover:underline">termeni</Link>.
          </p>
        </div>

        {done ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm">{done}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="rounded-2xl border border-slate-200 p-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Nume (persoană sau firmă)</span>
              <input className={cls('name')} value={form.name} onChange={set('name')} autoComplete="name" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
              <input className={cls('email')} type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Contractul de la care vă retrageți</span>
              <input
                className={cls('contract')}
                value={form.contract}
                onChange={set('contract')}
                placeholder="ex. emailul contului Easy ITP, pachetul sau numărul facturii"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Mesaj (opțional)</span>
              <textarea className={`${INPUT} border-slate-200`} rows={3} value={form.message} onChange={set('message')} />
            </label>
            {/* capcana pentru boti */}
            <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden="true" name="website" />
            {error && (
              <p className="flex items-start gap-2 text-sm text-red-600">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Confirmați retragerea
            </button>
            <p className="text-xs text-slate-500">
              Puteți trimite cererea și pe email, la{' '}
              <a href={`mailto:${COMPANY.email}`} className="text-blue-600 hover:underline">{COMPANY.email}</a>.
            </p>
          </form>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
