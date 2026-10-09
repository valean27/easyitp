import { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Download, Loader2, Smartphone } from 'lucide-react';
import { getPushStatus, sendTestPush, type PushStatus } from '../api/pushApi';
import { canInstall, currentSubscription, disablePush, enablePush, install, isIos, isStandalone, onInstallChange, pushSupported } from '../utils/device';
import { apiMessage } from '../utils/errors';

const BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60';

// Aplicatia instalabila si notificarile push pe dispozitivul curent (Contul meu pentru manager, „Ziua mea” pentru inspector)
export default function AppDeviceSettings({ who }: { who: 'manager' | 'inspector' }) {
  const [installable, setInstallable] = useState(canInstall());
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const standalone = isStandalone();
  const ios = isIos();

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getPushStatus());
    } catch {
      setStatus(null);
    }
    const sub = pushSupported() ? await currentSubscription().catch(() => null) : null;
    setSubscribed(!!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Nu a mers. Încercați din nou.'), ok: false });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const turnOn = () =>
    run(async () => {
      if (!status?.publicKey) return;
      const result = await enablePush(status.publicKey);
      setMessage(result.ok ? { text: 'Notificările sunt pornite pe acest dispozitiv.', ok: true } : { text: result.reason, ok: false });
    });

  const turnOff = () =>
    run(async () => {
      await disablePush();
      setMessage({ text: 'Notificările sunt oprite pe acest dispozitiv.', ok: true });
    });

  const test = () =>
    run(async () => {
      await sendTestPush();
      setMessage({ text: 'Am trimis o notificare de probă. Ar trebui să apară în câteva secunde.', ok: true });
    });

  const what =
    who === 'manager'
      ? 'Aflați pe loc de programările online noi, de clienții care își mută sau anulează programarea și de ITP-urile făcute de inspectori.'
      : 'Aflați pe loc când un client se programează, își mută sau își anulează programarea azi sau mâine, pe linia dumneavoastră.';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Smartphone size={15} className="text-slate-400" /> Aplicația pe acest dispozitiv
        </p>
        {standalone ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 size={15} /> Instalată: o deschideți de pe ecranul principal.
          </p>
        ) : installable ? (
          <>
            <p className="text-xs text-slate-500">Se deschide ca o aplicație, fără bara browserului; programările de azi se văd și fără internet.</p>
            <button type="button" onClick={() => install()} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
              <Download size={15} /> Instalează aplicația
            </button>
          </>
        ) : ios ? (
          <p className="text-xs text-slate-500">
            În Safari apăsați <b>Partajează</b> (pătratul cu săgeata) → <b>Adaugă pe ecranul principal</b>. Pe iPhone notificările merg doar
            din aplicația instalată.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Din meniul browserului alegeți <b>Instalează aplicația</b> sau <b>Adaugă pe ecranul principal</b> (Chrome, Edge, Samsung
            Internet). Merge pe telefon și pe calculator.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <BellRing size={15} className="text-slate-400" /> Notificări pe acest dispozitiv
        </p>
        <p className="text-xs text-slate-500">{what}</p>
        {status === null ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : !status.available ? (
          <p className="text-xs text-slate-500">Notificările nu sunt încă pornite pe server.</p>
        ) : !pushSupported() ? (
          <p className="text-xs text-slate-500">
            {ios ? 'Pe iPhone instalați întâi aplicația (mai sus), apoi porniți notificările din ea.' : 'Browserul acesta nu primește notificări.'}
          </p>
        ) : subscribed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 mr-1">
              <CheckCircle2 size={15} /> Pornite
            </span>
            <button type="button" onClick={test} disabled={busy} className={`${BTN} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
              Trimite o probă
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className={`${BTN} text-slate-500 hover:bg-slate-50`}>
              Oprește
            </button>
          </div>
        ) : (
          <button type="button" onClick={turnOn} disabled={busy} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />} Pornește notificările
          </button>
        )}
        {status && status.devices > 0 && (
          <p className="text-xs text-slate-400">
            Pe contul dumneavoastră: {status.devices === 1 ? '1 dispozitiv' : `${status.devices} dispozitive`} cu notificări.
          </p>
        )}
        {message && <p className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
      </div>
    </div>
  );
}
