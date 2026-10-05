import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Star, Loader2, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import type { Visibility } from '../types';
import { getVisibility, updateVisibility } from '../api/accountApi';

type Message = { text: string; type: 'success' | 'error' } | null;

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Recenzii si vizibilitate: linkul de recenzie Google, harta, Facebook, SMS-ul de dupa ITP si afisul cu QR
export default function VisibilityCard() {
  const [settings, setSettings] = useState<Visibility | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getVisibility()
      .then(setSettings)
      .catch(() => setMessage({ text: 'Setările nu au putut fi încărcate.', type: 'error' }));
  }, []);

  const update = (changes: Partial<Visibility>) => {
    setSettings((s) => (s ? { ...s, ...changes } : s));
    setDirty(true);
    setMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      setSettings(await updateVisibility(settings));
      setDirty(false);
      setMessage({ text: 'Salvat.', type: 'success' });
    } catch (err) {
      const text = axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;
      setMessage({ text: text ?? 'Setările nu au putut fi salvate.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: 'reviewUrl' | 'mapsUrl' | 'facebookUrl', label: string, placeholder: string, help?: string) => (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        value={settings?.[key] ?? ''}
        onChange={(e) => update({ [key]: e.target.value })}
        placeholder={placeholder}
        inputMode="url"
        className={INPUT_CLS}
      />
      {help && <p className="text-xs text-slate-400 mt-1">{help}</p>}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Star size={15} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-700">Recenzii și vizibilitate</h2>
      </div>
      {!settings ? (
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      ) : (
        <form onSubmit={save} className="px-6 py-5 space-y-4">
          {field(
            'reviewUrl',
            'Link de recenzie Google',
            'https://g.page/r/.../review',
            'Din Google Business Profile: „Cereți recenzii” → copiați linkul.'
          )}
          {field('mapsUrl', 'Link Google Maps', 'https://maps.app.goo.gl/...', 'Apare pe pagina de programare și în lista stațiilor.')}
          {field('facebookUrl', 'Pagina de Facebook', 'https://facebook.com/...')}

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.reviewSms}
              onChange={(e) => update({ reviewSms: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              SMS cu cererea de recenzie în dimineața de după ITP
              <span className="block text-xs text-slate-400">
                Doar după un ITP admis, clienților cu acord pentru mesaje, cel mult o dată pe an. Pleacă pe canalul ales la
                „SMS automate”.
              </span>
            </span>
          </label>

          {message && (
            <p className={`flex items-center gap-1.5 text-sm ${message.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
              {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/afis"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer size={15} /> Afiș cu cod QR
            </Link>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              Salvează
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
