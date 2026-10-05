import { useEffect, useState } from 'react';
import { Receipt, Loader2, CheckCircle2, AlertTriangle, Plug } from 'lucide-react';
import SettingsCard from './SettingsCard';
import type { InvoicingOptions, InvoicingSettings } from '../types';
import { getInvoicingOptions, getInvoicingSettings, updateInvoicingSettings } from '../api/invoicingApi';
import { apiMessage } from '../utils/errors';

type Message = { text: string; type: 'success' | 'error' } | null;

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Contul meu -> Facturare (Oblio): contul Oblio al statiei, firma emitenta, seria, cota TVA, e-Factura
export default function InvoicingCard() {
  const [s, setS] = useState<InvoicingSettings | null>(null);
  const [secret, setSecret] = useState('');
  const [options, setOptions] = useState<InvoicingOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getInvoicingSettings()
      .then((settings) => {
        setS(settings);
        if (settings.email && settings.hasSecret) getInvoicingOptions().then(setOptions).catch(() => setOptions(null));
      })
      .catch(() => setMessage({ text: 'Setările nu au putut fi încărcate.', type: 'error' }));
  }, []);

  const update = (changes: Partial<InvoicingSettings>) => setS((x) => (x ? { ...x, ...changes } : x));

  // salveaza emailul + cheia, apoi citeste firmele, seriile si cotele din Oblio
  const connect = async () => {
    if (!s) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await updateInvoicingSettings({ ...s, secret: secret.trim() || null });
      setS(saved);
      setSecret('');
      const opts = await getInvoicingOptions();
      setOptions(opts);
      const only = opts.companies.length === 1 ? opts.companies[0].cif : saved.cif;
      setS((x) => (x ? { ...x, cif: x.cif ?? only } : x));
      setMessage({ text: `Conectat la Oblio (${opts.companies.length} ${opts.companies.length === 1 ? 'firmă' : 'firme'}). Alegeți seria și cota TVA.`, type: 'success' });
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Conectarea la Oblio nu a reușit.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const chooseCompany = async (cif: string) => {
    update({ cif, series: null, vatName: null, vatPercent: null });
    try {
      setOptions(await getInvoicingOptions(cif));
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Seriile nu au putut fi citite.'), type: 'error' });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setMessage(null);
    try {
      setS(await updateInvoicingSettings({ ...s, secret: secret.trim() || null }));
      setSecret('');
      setMessage({ text: 'Salvat.', type: 'success' });
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Setările nu au putut fi salvate.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const summary = !s ? undefined : s.ready ? `Gata · seria ${s.series}${s.einvoice ? ' · e-Factura automat' : ''}` : s.email ? 'De completat' : 'Neconfigurat';

  return (
    <SettingsCard id="facturare" icon={<Receipt size={15} />} title="Facturare (Oblio)" summary={summary}>
      {!s ? (
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          {message ? message.text : (<><Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...</>)}
        </div>
      ) : (
        <form onSubmit={save} className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            Facturi reale din centralizatorul lunar al flotelor și pentru ITP-urile persoanelor fizice, emise în contul Oblio al
            stației. Cheia API o găsiți în Oblio: Setări → Date cont.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Emailul contului Oblio
              <input value={s.email ?? ''} onChange={(e) => update({ email: e.target.value })} type="email" className={`${INPUT_CLS} mt-1`} />
            </label>
            <label className="text-xs text-slate-500">
              Cheia API
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder={s.hasSecret ? 'salvată (gol = o păstrăm)' : ''}
                className={`${INPUT_CLS} mt-1`}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={busy || !s.email || (!s.hasSecret && !secret.trim())}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />} {options ? 'Reconectează' : 'Conectează la Oblio'}
          </button>

          {options && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs text-slate-500">
                Firma emitentă
                <select value={s.cif ?? ''} onChange={(e) => chooseCompany(e.target.value)} className={`${INPUT_CLS} mt-1`}>
                  <option value="">— alegeți —</option>
                  {options.companies.map((c) => (
                    <option key={c.cif} value={c.cif}>
                      {c.name} ({c.cif})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Seria facturilor
                <select value={s.series ?? ''} onChange={(e) => update({ series: e.target.value || null })} className={`${INPUT_CLS} mt-1`}>
                  <option value="">— alegeți —</option>
                  {options.series.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Cota TVA
                <select
                  value={s.vatName ?? ''}
                  onChange={(e) => {
                    const v = options.vatRates.find((r) => r.name === e.target.value);
                    update({ vatName: v?.name ?? null, vatPercent: v?.percent ?? null });
                  }}
                  className={`${INPUT_CLS} mt-1`}
                >
                  <option value="">— alegeți —</option>
                  {options.vatRates.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.percent}%)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={s.vatIncluded}
                onChange={(e) => update({ vatIncluded: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Prețurile ITP includ TVA
            </label>
            <label className="text-xs text-slate-500">
              Termen de plată (zile)
              <input
                type="number"
                min={0}
                max={120}
                value={s.dueDays}
                onChange={(e) => update({ dueDays: Number(e.target.value) })}
                className={`${INPUT_CLS} mt-1`}
              />
            </label>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={s.einvoice}
              onChange={(e) => update({ einvoice: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Trimite automat factura în e-Factura (SPV)
              <span className="block text-xs text-slate-400">Contul Oblio trebuie să fie legat de SPV (Oblio → Setări → e-Factura).</span>
            </span>
          </label>

          {message && (
            <p className={`flex items-center gap-1.5 text-sm ${message.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
              {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {message.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} Salvează
            </button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
