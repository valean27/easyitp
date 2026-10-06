import { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, Loader2, Send, Smartphone, Server, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { AutoSmsLogEntry, AutoSmsSettings, Profile, SmsProvider } from '../types';
import { getAutoSms, getAutoSmsLog, getProfile, sendTestSms, updateAutoSms } from '../api/accountApi';
import { bookingUrl } from '../utils/booking';
import { renderSms, smsSegments } from '../utils/smsText';
import { apiMessage } from '../utils/errors';
import { formatDateRo } from '../utils/fleet';
import { SMS_PLANS, planLabel } from '../utils/smsPlans';
import PlanLock from './PlanLock';

type Message = { text: string; type: 'success' | 'error' } | null;

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const STAGE_OPTIONS = [60, 30, 14, 7, 3, 1];

const PROVIDERS: { key: SmsProvider; title: string; subtitle: string; icon: typeof Smartphone }[] = [
  { key: 'PLATFORM', title: 'Inclus în abonament', subtitle: 'Fără cont și fără telefon; din pachetul lunar', icon: Package },
  { key: 'SMS_GATE', title: 'Telefonul stației', subtitle: 'Gratuit, cu SMS-urile din abonament', icon: Smartphone },
  { key: 'SMSLINK', title: 'Gateway SMSLink', subtitle: 'Plătit la SMS (~0,045 €), fără telefon', icon: Server },
];

function LogList({ entries }: { entries: AutoSmsLogEntry[] }) {
  if (entries.length === 0) return <p className="text-xs text-slate-400">Niciun SMS trimis încă.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <li key={i} className="px-3 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-slate-500 tabular-nums">{formatDateRo(e.sentAt.slice(0, 10))} {e.sentAt.slice(11, 16)}</span>
          <span className="font-mono font-semibold text-slate-700">{e.plate ?? '—'}</span>
          <span className="text-slate-600 truncate">{e.clientName ?? ''}</span>
          <span className="text-slate-400">
            {e.kind ?? 'ITP'} · cu {e.stage} zile înainte
          </span>
          {e.status === 'SENT' ? (
            <span className="ml-auto text-emerald-600 font-medium">trimis</span>
          ) : (
            <span className="ml-auto text-red-600" title={e.error ?? ''}>
              eșuat{e.attempts > 1 ? ` (${e.attempts} încercări)` : ''}: {e.error}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Remindere SMS trimise singure clientilor cu acord, de pe telefonul statiei sau prin SMSLink
export default function AutoSmsCard() {
  const [settings, setSettings] = useState<AutoSmsSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<AutoSmsLogEntry[] | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getAutoSms()
      .then((s) => {
        setSettings(s);
        setShowAdvanced(!!s.smsGateUrl);
      })
      .catch(() => setMessage({ text: 'Setările SMS nu au putut fi încărcate.', type: 'error' }));
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const stationName = profile?.stationName ?? '';
  const stationPhone = profile?.phone ?? '';
  const bookingLink = profile?.bookingEnabled && profile.bookingSlug ? bookingUrl(profile.bookingSlug) : null;

  const preview = useMemo(() => {
    if (!settings) return '';
    const expiry = new Date(Date.now() + (settings.days[0] ?? 30) * 86_400_000).toISOString().slice(0, 10);
    return renderSms(settings.template, settings.defaultTemplate, {
      nume: 'Ion Popescu',
      numar: 'CJ 01 ABC',
      masina: 'Dacia Logan',
      dataExpirare: expiry,
      expirat: false,
      statie: stationName || 'Stația ITP',
      adresa: null,
      telefon: stationPhone || null,
      link: bookingLink,
      stop: `${window.location.origin}/stop/a1b2c3d4e5f6g7h8i9j0k1l2`,
    });
  }, [settings, stationName, stationPhone, bookingLink]);

  if (!settings) {
    return (
      <SettingsCard icon={<MessageSquareText size={15} />} title="Remindere SMS automate">
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      </SettingsCard>
    );
  }

  const update = (changes: Partial<AutoSmsSettings>) => {
    setSettings((s) => (s ? { ...s, ...changes } : s));
    setMessage(null);
  };

  const toggleStage = (day: number) => {
    const days = settings.days.includes(day) ? settings.days.filter((d) => d !== day) : [...settings.days, day];
    update({ days: days.sort((a, b) => b - a) });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateAutoSms(settings);
      setSettings(saved);
      setMessage({
        text: saved.enabled ? 'Salvat. SMS-urile pleacă singure în fiecare dimineață.' : 'Salvat. SMS-urile automate sunt oprite.',
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Setările nu au putut fi salvate.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      setMessage({ text: await sendTestSms(testPhone.trim() || stationPhone), type: 'success' });
    } catch (err) {
      setMessage({ text: apiMessage(err, 'SMS-ul de test nu a plecat. Salvați întâi setările.'), type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const openLog = () => {
    setShowLog((v) => !v);
    if (!log) getAutoSmsLog().then(setLog).catch(() => setLog([]));
  };

  const segments = smsSegments(preview);

  return (
    <SettingsCard
      icon={<MessageSquareText size={15} />}
      title="Remindere SMS automate"
      summary={[
        settings.enabled ? `Pornite · ${PROVIDERS.find((p) => p.key === settings.provider)?.title ?? ''}` : 'Oprite',
        settings.sentLast30Days > 0 ? `${settings.sentLast30Days} trimise în 30 de zile` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    >

      <form onSubmit={save} className="p-5 space-y-5">
        <PlanLock
          feature="AUTO_SMS"
          text="SMS-urile automate (remindere ITP, confirmări și remindere la programări, RCA / rovinietă / tahograf) fac parte din pachetul Pro. Setările se pot pregăti de acum; pornesc după alegerea pachetului."
        />
        <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="font-medium">Trimite singur SMS clienților înainte să le expire ITP-ul</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Doar clienților care și-au dat acordul și nu au deja o programare. Pleacă dimineața (în jurul orei 7:30,
              luni–sâmbătă), o singură dată pentru fiecare termen.
            </span>
          </span>
        </label>

        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">Cum se trimit</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROVIDERS.filter((p) => p.key !== 'PLATFORM' || settings.platformAvailable).map(({ key, title, subtitle, icon: Icon }) => (
              <button
                type="button"
                key={key}
                onClick={() => update({ provider: key })}
                className={`text-left rounded-lg border p-3 flex gap-3 transition-colors ${
                  settings.provider === key ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} className={settings.provider === key ? 'text-blue-600' : 'text-slate-400'} />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{title}</span>
                  <span className="block text-xs text-slate-500">{subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {settings.provider === 'PLATFORM' && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-2">
            {settings.smsPlan > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{planLabel(settings.smsPlan)} pe lună</span>
                  <span className="font-semibold tabular-nums text-slate-800">
                    {settings.smsUsedThisMonth} / {settings.smsPlan} folosite luna aceasta
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full ${settings.smsUsedThisMonth >= settings.smsPlan ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, (settings.smsUsedThisMonth / settings.smsPlan) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Un mesaj mai lung de 160 de caractere se numără ca două SMS-uri. Când pachetul se termină, SMS-urile se opresc
                  până la începutul lunii următoare.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Stația nu are încă un pachet de SMS. Pachete: {SMS_PLANS.map((p) => `${p.sms} SMS / ${p.price} RON`).join(' · ')} pe
                lună (fără TVA). Scrieți-ne și îl activăm.
              </p>
            )}
          </div>
        )}

        {settings.provider === 'SMS_GATE' && (
          <div className="space-y-3 rounded-lg bg-slate-50 border border-slate-100 p-4">
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
              <li>
                Pe un telefon Android cu SIM-ul stației instalați aplicația{' '}
                <a href="https://sms-gate.app/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                  SMS Gateway for Android <ExternalLink size={11} />
                </a>
                .
              </li>
              <li>În aplicație porniți <b>Cloud server</b> și apăsați „Online”.</li>
              <li>Copiați aici utilizatorul și parola afișate în secțiunea Cloud server.</li>
              <li>Telefonul trebuie să rămână pornit și cu internet; SMS-urile pleacă din abonamentul lui.</li>
            </ol>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={settings.smsGateUsername ?? ''}
                onChange={(e) => update({ smsGateUsername: e.target.value })}
                placeholder="Utilizator (ex. ABCD12)"
                autoComplete="off"
                className={INPUT_CLS}
              />
              <input
                type="password"
                value={settings.smsGatePassword ?? ''}
                onChange={(e) => update({ smsGatePassword: e.target.value })}
                placeholder={settings.hasSmsGatePassword ? 'Parolă salvată (lăsați gol)' : 'Parolă'}
                autoComplete="new-password"
                className={INPUT_CLS}
              />
            </div>
            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-slate-500 hover:text-slate-700">
              {showAdvanced ? 'Ascunde' : 'Server propriu (avansat)'}
            </button>
            {showAdvanced && (
              <input
                value={settings.smsGateUrl ?? ''}
                onChange={(e) => update({ smsGateUrl: e.target.value })}
                placeholder="https://sms.statia-mea.ro (gol = serverul public sms-gate.app)"
                className={INPUT_CLS}
              />
            )}
          </div>
        )}

        {settings.provider === 'SMSLINK' && (
          <div className="space-y-3 rounded-lg bg-slate-50 border border-slate-100 p-4">
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
              <li>
                Faceți cont pe{' '}
                <a href="https://www.smslink.ro/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                  smslink.ro <ExternalLink size={11} />
                </a>{' '}
                și încărcați credit.
              </li>
              <li>La <b>SMS Gateway</b> creați o conexiune nouă.</li>
              <li>Copiați aici Connection ID și parola conexiunii.</li>
            </ol>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={settings.smslinkConnectionId ?? ''}
                onChange={(e) => update({ smslinkConnectionId: e.target.value })}
                placeholder="Connection ID"
                autoComplete="off"
                className={INPUT_CLS}
              />
              <input
                type="password"
                value={settings.smslinkPassword ?? ''}
                onChange={(e) => update({ smslinkPassword: e.target.value })}
                placeholder={settings.hasSmslinkPassword ? 'Parolă salvată (lăsați gol)' : 'Parolă'}
                autoComplete="new-password"
                className={INPUT_CLS}
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-100 p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">SMS pentru programări</p>
          <p className="text-xs text-slate-500">
            Pe același canal. Clientul primește un link din care își poate anula sau muta singur programarea, ca să nu rămână
            ore goale.
          </p>
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.apptConfirmSms}
              onChange={(e) => update({ apptConfirmSms: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Confirmare imediat după programarea online
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.apptReminderSms}
              onChange={(e) => update({ apptReminderSms: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Reminder în dimineața dinaintea programării (sâmbătă și pentru luni)
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">Cu câte zile înainte de expirare</p>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleStage(d)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                  settings.days.includes(d) ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d} {d === 1 ? 'zi' : 'zile'}
              </button>
            ))}
          </div>
          {settings.days.length === 0 && <p className="text-xs text-slate-400 mt-1">Fără selecție se folosesc 30 și 7 zile.</p>}
          <label className="mt-3 flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.deadlinesSms}
              onChange={(e) => update({ deadlinesSms: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Și pentru RCA, rovinietă și tahograf, cu 7 zile înainte
              <span className="block text-xs text-slate-400">
                Doar unde ați completat data (în formularul ITP sau în fișa clientului) și nu ați marcat deja clientul ca
                „Contactat”.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Textul SMS-ului</label>
          <textarea
            value={settings.template}
            onChange={(e) => update({ template: e.target.value })}
            rows={3}
            maxLength={600}
            className={INPUT_CLS + ' resize-none'}
          />
          <p className="text-xs text-slate-400 mt-1">
            Aceleași câmpuri ca la mesajele manuale ({'{nume}'}, {'{numar}'}, {'{data}'}, {'{statie}'}, {'{telefon}'}, {'{link}'}...).
            Diacriticele se scot automat; link-ul de dezabonare se adaugă la final.
          </p>
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{preview}</p>
            <p className={`text-xs mt-1 ${segments > 1 ? 'text-amber-700' : 'text-slate-400'}`}>
              {preview.length} caractere · {segments} {segments === 1 ? 'SMS' : 'SMS-uri'} pe client
              {segments > 1 && settings.provider === 'SMSLINK' ? ' (se plătește fiecare)' : ''}
            </p>
          </div>
        </div>

        {message && (
          <p
            className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
              message.type === 'success' ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
            {message.text}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Salvează
          </button>
          <div className="flex gap-2 sm:ml-auto">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder={stationPhone || 'Telefon pentru test'}
              inputMode="tel"
              className={INPUT_CLS + ' sm:w-44'}
            />
            <button
              type="button"
              onClick={test}
              disabled={testing || !settings.provider}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              SMS de test
            </button>
          </div>
        </div>

        <div>
          <button type="button" onClick={openLog} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            {showLog ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Jurnalul trimiterilor
          </button>
          {showLog && <div className="mt-2">{log ? <LogList entries={log} /> : <Loader2 size={15} className="animate-spin text-slate-400" />}</div>}
        </div>
      </form>
    </SettingsCard>
  );
}
