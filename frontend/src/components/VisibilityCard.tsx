import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Star, Loader2, CheckCircle2, AlertTriangle, Printer, Search } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { GooglePlace, Visibility } from '../types';
import { getProfile, getVisibility, linkGooglePlace, searchGooglePlace, unlinkGooglePlace, updateVisibility } from '../api/accountApi';
import StarRating from './StarRating';
import PlanLock from './PlanLock';
import { usePlan } from '../context/plan';

type Message = { text: string; type: 'success' | 'error' } | null;

const serverMessage = (err: unknown) =>
  axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;

// Nota de pe Google: statia isi cauta locul (nume + oras) si il alege; nota apare apoi in /statii si la programare
function GooglePlacePicker({ settings, onChange }: { settings: Visibility; onChange: (v: Visibility) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GooglePlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => setQuery((q) => q || [p.stationName, p.address].filter(Boolean).join(' ')))
      .catch(() => undefined);
  }, []);

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(serverMessage(err) ?? 'Google nu a răspuns. Încercați din nou.');
    } finally {
      setBusy(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) act(async () => setResults(await searchGooglePlace(query.trim())));
  };

  return (
    <div className="rounded-lg border border-slate-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">Nota de pe Google</p>
        <p className="text-xs text-slate-500">Stelele și numărul de recenzii apar în lista stațiilor și pe pagina de programare.</p>
      </div>
      {settings.googlePlaceId ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {settings.googleRating != null ? (
            <StarRating rating={settings.googleRating} count={settings.googleRatingCount} />
          ) : (
            <span className="text-sm text-slate-500">Locul nu are încă recenzii pe Google.</span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => onChange(await unlinkGooglePlace()))}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            Elimină
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(e)}
              placeholder="Numele stației și orașul"
              className={INPUT_CLS}
            />
            <button
              type="button"
              onClick={search}
              disabled={busy || !query.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 shrink-0"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Caută
            </button>
          </div>
          {results && results.length === 0 && <p className="text-xs text-slate-500">Nu am găsit nimic. Încercați alt nume sau orașul.</p>}
          {results && results.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {results.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.address}</p>
                    {p.rating != null && <StarRating rating={p.rating} count={p.ratingCount} />}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(async () => onChange(await linkGooglePlace(p.id)))}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shrink-0"
                  >
                    Asta e stația
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Recenzii si vizibilitate: linkul de recenzie Google, harta, Facebook, SMS-ul de dupa ITP si afisul cu QR
export default function VisibilityCard() {
  const { has } = usePlan();
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
      setMessage({ text: serverMessage(err) ?? 'Setările nu au putut fi salvate.', type: 'error' });
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
    <SettingsCard
      id="recenzii"
      icon={<Star size={15} />}
      title="Recenzii și vizibilitate"
      summary={
        settings &&
        ([
          settings.googleRating != null ? `${settings.googleRating.toFixed(1).replace('.', ',')} ★ pe Google` : null,
          settings.reviewUrl ? 'link de recenzie' : null,
          settings.reviewSms ? 'SMS după ITP' : null,
        ]
          .filter(Boolean)
          .join(' · ') ||
          'Necompletat')
      }
    >
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

          <PlanLock
            feature="REVIEWS"
            text="Linkurile apar pe pagina de programare în orice pachet. Nota Google în lista stațiilor și SMS-ul cu cererea de recenzie fac parte din pachetul Premium."
          />
          {settings.googleAvailable && has('REVIEWS') && (
            <GooglePlacePicker
              settings={settings}
              // alegerea locului se salveaza imediat; pastram ce era nesalvat in restul formularului
              onChange={(v) =>
                setSettings((s) => (s ? { ...s, googlePlaceId: v.googlePlaceId, googleRating: v.googleRating, googleRatingCount: v.googleRatingCount, mapsUrl: s.mapsUrl || v.mapsUrl } : v))
              }
            />
          )}

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.reviewSms}
              onChange={(e) => update({ reviewSms: e.target.checked })}
              disabled={!has('REVIEWS') && !settings.reviewSms}
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
    </SettingsCard>
  );
}
