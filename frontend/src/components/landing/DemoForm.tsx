import { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { submitLead } from '../../api/publicApi';
import { apiMessage } from '../../utils/errors';

const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Formularul "Cere o demonstratie": cererea ajunge la admin (in aplicatie si pe email)
export default function DemoForm() {
  const [form, setForm] = useState({ name: '', station: '', city: '', phone: '', email: '', message: '', website: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Lăsați un telefon sau un email ca să vă putem contacta.');
      return;
    }
    setSending(true);
    try {
      await submitLead(form);
      setDone(true);
    } catch (err) {
      setError(apiMessage(err, 'Cererea nu a putut fi trimisă. Încercați din nou.'));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
        <p className="text-lg font-bold text-slate-800">Mulțumim, am primit cererea!</p>
        <p className="text-sm text-slate-500">Vă contactăm în curând ca să vă arătăm aplicația pe datele stației dumneavoastră.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required minLength={2} maxLength={100} value={form.name} onChange={set('name')} placeholder="Nume și prenume *" autoComplete="name" className={INPUT_CLS} />
        <input maxLength={150} value={form.station} onChange={set('station')} placeholder="Numele stației ITP" autoComplete="organization" className={INPUT_CLS} />
        <input maxLength={80} value={form.city} onChange={set('city')} placeholder="Oraș" autoComplete="address-level2" className={INPUT_CLS} />
        <input type="tel" maxLength={30} value={form.phone} onChange={set('phone')} placeholder="Telefon" autoComplete="tel" className={INPUT_CLS} />
      </div>
      <input type="email" maxLength={150} value={form.email} onChange={set('email')} placeholder="Email" autoComplete="email" className={INPUT_CLS} />
      <textarea maxLength={1000} value={form.message} onChange={set('message')} rows={3} placeholder="Ce vă interesează? (opțional)" className={INPUT_CLS + ' resize-none'} />
      {/* Camp-capcana pentru boti: ascuns pentru oameni */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden="true" />
      {error && (
        <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Cere o demonstrație
      </button>
      <p className="text-xs text-slate-400 text-center">Folosim aceste date doar ca să vă contactăm despre Easy ITP.</p>
    </form>
  );
}
