import { useEffect, useState } from 'react';
import axios from 'axios';
import { Mail, Loader2, Send, CheckCircle2, AlertTriangle, MessageCircle, ExternalLink } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { DigestChannel, DigestSettings } from '../types';
import { getDigestSettings, sendTestDigest, updateDigestSettings } from '../api/accountApi';
import { useAuth } from '../context/auth';

type Message = { text: string; type: 'success' | 'error' } | null;

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Deschide WhatsApp cu mesajul de activare catre botul CallMeBot deja scris
const CALLMEBOT_ACTIVATION = 'https://wa.me/34644992698?text=' + encodeURIComponent('I allow callmebot to send me messages');

function serverMessage(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;
}

// Rezumatul de dimineata (programarile zilei, clientii de contactat) pe email sau WhatsApp
export default function DigestCard() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getDigestSettings()
      .then(setSettings)
      .catch(() => setMessage({ text: 'Setările nu au putut fi încărcate.', type: 'error' }));
  }, []);

  if (!settings) {
    return (
      <SettingsCard id="rezumat" icon={<Mail size={15} />} title="Rezumat zilnic">
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      </SettingsCard>
    );
  }

  const update = (changes: Partial<DigestSettings>) => {
    setSettings((s) => (s ? { ...s, ...changes } : s));
    setDirty(true);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateDigestSettings({ ...settings, callmebotApiKey: apiKey.trim() || undefined });
      setSettings(saved);
      setApiKey('');
      setDirty(false);
      setMessage({ text: 'Setările au fost salvate. Trimite un mesaj de test ca să verifici.', type: 'success' });
    } catch (err) {
      setMessage({ text: serverMessage(err) ?? 'Setările nu au putut fi salvate.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setSending(true);
    setMessage(null);
    try {
      await sendTestDigest();
      setMessage({
        text:
          settings.channel === 'WHATSAPP'
            ? `Mesaj trimis pe WhatsApp la ${settings.whatsappPhone}. Poate dura până la un minut.`
            : `Email trimis la ${user?.email}. Verifică și folderul Spam.`,
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: serverMessage(err) ?? 'Mesajul nu a putut fi trimis.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const channelButton = (channel: DigestChannel, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => update({ channel })}
      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
        settings.channel === channel
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <SettingsCard
      id="rezumat"
      icon={<Mail size={15} />}
      title="Rezumat zilnic"
      summary={settings.enabled ? `Pornit · pe ${settings.channel === 'WHATSAPP' ? 'WhatsApp' : 'email'}` : 'Oprit'}
    >
      <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            <span className="font-medium">Primesc dimineața un rezumat</span>
            <span className="block text-xs text-slate-400">
              Luni–sâmbătă: programările zilei, programările online noi și clienții cărora le expiră ITP-ul. Dacă nu e
              nimic de raportat, nu se trimite nimic.
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          {channelButton('EMAIL', 'Email', <Mail size={15} />)}
          {channelButton('WHATSAPP', 'WhatsApp', <MessageCircle size={15} />)}
        </div>

        {settings.channel === 'EMAIL' ? (
          <p className="text-xs text-slate-500">Se trimite la {user?.email}.</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
              <li>
                Deschide de pe telefon{' '}
                <a href={CALLMEBOT_ACTIVATION} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 underline">
                  activarea CallMeBot <ExternalLink size={11} />
                </a>{' '}
                și trimite mesajul gata scris.
              </li>
              <li>În 1–2 minute primești pe WhatsApp o cheie (apikey). Copiaz-o mai jos.</li>
              <li>Salvează, apoi trimite un mesaj de test.</li>
            </ol>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Numărul tău de WhatsApp</label>
              <input
                type="tel"
                value={settings.whatsappPhone ?? ''}
                onChange={(e) => update({ whatsappPhone: e.target.value })}
                placeholder="07xx xxx xxx"
                className={INPUT_CLS + ' bg-white'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Cheia CallMeBot</label>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setDirty(true);
                  setMessage(null);
                }}
                placeholder={settings.hasApiKey ? 'Cheie salvată (lasă gol ca s-o păstrezi)' : 'ex. 1234567'}
                className={INPUT_CLS + ' bg-white'}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              CallMeBot e un serviciu gratuit pentru notificări personale. Mesajele vin de la numărul botului. Dacă nu
              ajung, poți reveni oricând la email.
            </p>
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

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Salvează
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={sending || dirty}
            title={dirty ? 'Salvează mai întâi modificările' : undefined}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Trimite un test acum
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
