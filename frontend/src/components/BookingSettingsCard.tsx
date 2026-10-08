import { useEffect, useState } from 'react';
import { Globe, Loader2, CheckCircle2, AlertTriangle, Copy, Check, ExternalLink, Timer } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { BookingSettings, VehicleCategory, VehicleType } from '../types';
import { getBookingSettings, updateBookingSettings } from '../api/accountApi';
import { WEEKDAYS_SHORT, bookingUrl } from '../utils/booking';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

type Message = { text: string; type: 'success' | 'error' } | null;

// Setarile paginii publice de programare a statiei
export default function BookingSettingsCard({ onChange }: { onChange?: (s: BookingSettings) => void }) {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getBookingSettings()
      .then((s) => {
        setSettings(s);
        onChange?.(s);
      })
      .catch(() => setMessage({ text: 'Setările nu au putut fi încărcate.', type: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) {
    return (
      <SettingsCard id="programare" icon={<Globe size={15} />} title="Programare online">
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      </SettingsCard>
    );
  }

  const update = (changes: Partial<BookingSettings>) => setSettings((s) => (s ? { ...s, ...changes } : s));

  const updateType = (category: VehicleCategory, changes: Partial<VehicleType>) =>
    update({ vehicleTypes: settings.vehicleTypes.map((t) => (t.category === category ? { ...t, ...changes } : t)) });

  const toggleDay = (day: number) =>
    update({ days: settings.days.includes(day) ? settings.days.filter((d) => d !== day) : [...settings.days, day].sort() });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const saved = await updateBookingSettings({
        ...settings,
        open: settings.open.length === 5 ? `${settings.open}:00` : settings.open,
        close: settings.close.length === 5 ? `${settings.close}:00` : settings.close,
        lineNames: Array.from({ length: settings.capacity }, (_, i) => settings.lineNames?.[i] ?? ''),
        bookingMessage: settings.bookingMessage ?? '',
      });
      setSettings(saved);
      onChange?.(saved);
      setMessage({ text: saved.enabled ? 'Programarea online este activă.' : 'Setările au fost salvate.', type: 'success' });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({
        text:
          status === 409
            ? 'Link-ul este deja folosit de altă stație. Alegeți altul.'
            : 'Verificați datele: link doar cu litere mici, cifre și cratime; ora de deschidere înaintea celei de închidere; cel puțin o zi; cel puțin un tip de vehicul, cu durata între 10 și 120 de minute, din 5 în 5.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const link = settings.slug ? bookingUrl(settings.slug) : null;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil */
    }
  };

  return (
    <SettingsCard
      id="programare"
      icon={<Globe size={15} />}
      title="Programare online"
      summary={settings.enabled && settings.slug ? `Pornită · /programare/${settings.slug}` : 'Oprită'}
    >
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            <span className="font-medium">Clienții se pot programa singuri</span>
            <span className="block text-xs text-slate-400">
              Pe o pagină publică, fără cont. Programările apar în calendar marcate „Online”.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Link</label>
          <div className="flex items-center rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
            <span className="pl-3 text-sm text-slate-400 whitespace-nowrap">/programare/</span>
            <input
              value={settings.slug ?? ''}
              onChange={(e) => update({ slug: e.target.value.toLowerCase() })}
              placeholder="generat din numele stației"
              className="flex-1 min-w-0 px-1 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Deschis de la</label>
            <input type="time" step={1800} value={settings.open.slice(0, 5)} onChange={(e) => update({ open: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Până la</label>
            <input type="time" step={1800} value={settings.close.slice(0, 5)} onChange={(e) => update({ close: e.target.value })} className={INPUT_CLS} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Zile lucrătoare</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS_SHORT.map((label, i) => {
              const day = i + 1;
              const active = settings.days.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-11 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Linii ITP</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={settings.capacity}
            onChange={(e) => update({ capacity: Number(e.target.value) })}
            className={INPUT_CLS + ' w-24'}
          />
          <p className="text-xs text-slate-400 mt-1">
            Câte vehicule pot fi verificate în același timp. Clienții se pot programa la aceeași oră cât timp o linie e liberă,
            iar în Calendar → „Pe linii” fiecare linie are coloana ei.
          </p>
          {settings.capacity > 1 && settings.capacity <= 10 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: settings.capacity }, (_, i) => (
                <input
                  key={i}
                  value={settings.lineNames?.[i] ?? ''}
                  maxLength={40}
                  onChange={(e) => {
                    const names = Array.from({ length: settings.capacity }, (_, j) => settings.lineNames?.[j] ?? '');
                    names[i] = e.target.value;
                    update({ lineNames: names });
                  }}
                  placeholder={`Linia ${i + 1} (ex. autoturisme, sau numele inspectorului)`}
                  aria-label={`Numele liniei ${i + 1}`}
                  className={INPUT_CLS}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="booking-message" className="block text-sm font-medium text-slate-600 mb-1">
            Mesaj pe pagina de programare <span className="font-normal text-slate-400">(opțional)</span>
          </label>
          <textarea
            id="booking-message"
            value={settings.bookingMessage ?? ''}
            onChange={(e) => update({ bookingMessage: e.target.value })}
            maxLength={300}
            rows={2}
            placeholder="ex. Veniți cu 10 minute înainte. Plata se face cash sau cu cardul."
            className={INPUT_CLS + ' resize-y'}
          />
          <p className="text-xs text-slate-400 mt-1">
            Apare sus, sub numele stației. Logo-ul îl puneți în Date stație ITP.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.emailNotify}
            onChange={(e) => update({ emailNotify: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Primesc email la fiecare programare online
            <span className="block text-xs text-slate-400">
              Și când un client își anulează sau mută programarea din link. În aplicație le vedeți oricum la clopoțel.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.publicListing}
            onChange={(e) => update({ publicListing: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Apare în lista publică de stații
            <span className="block text-xs text-slate-400">
              Șoferii găsesc stația pe pagina „Stații ITP” din Easy ITP și se programează de acolo.
            </span>
          </span>
        </label>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600 mb-1">
            <Timer size={14} className="text-slate-400" />
            Durata inspecției pe tip de vehicul
          </label>
          <p className="text-xs text-slate-400 mb-2">
            Clientul alege tipul vehiculului, iar programarea blochează linia exact cât durează inspecția, fără
            suprapuneri. Verificați timpii minimi impuși stației voastre de RAR. Tipurile nebifate nu apar pe pagina online.
          </p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {settings.vehicleTypes.map((t) => (
              <div key={t.category} className="flex items-center gap-3 px-3 py-2">
                <label className="flex-1 flex items-center gap-2.5 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => updateType(t.category, { enabled: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm truncate ${t.enabled ? 'text-slate-700' : 'text-slate-400'}`}>{t.label}</span>
                </label>
                <div className="w-20 shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={120}
                    step={5}
                    disabled={!t.enabled}
                    value={t.minutes}
                    onChange={(e) => updateType(t.category, { minutes: Number(e.target.value) })}
                    aria-label={`Durata pentru ${t.label}`}
                    className={INPUT_CLS + ' disabled:bg-slate-50 disabled:text-slate-300'}
                  />
                </div>
                <span className="text-xs text-slate-400 w-6">min</span>
              </div>
            ))}
          </div>
        </div>

        {settings.enabled && link && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-2">
            <p className="text-xs text-blue-800">Trimite acest link clienților sau pune-l pe Google Maps / Facebook:</p>
            <p className="text-sm font-mono text-blue-900 break-all">{link}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiat' : 'Copiază'}
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <ExternalLink size={13} />
                Deschide
              </a>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
              message.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-600 bg-red-50 border-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Salvează
        </button>
      </form>
    </SettingsCard>
  );
}
