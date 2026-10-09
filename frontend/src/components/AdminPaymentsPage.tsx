import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Receipt, RefreshCw } from 'lucide-react';
import {
  getAdminPayments,
  getPlatformInvoicing,
  issuePaymentInvoice,
  removePlatformKey,
  savePlatformInvoicing,
  testPlatformInvoicing,
  type AdminPayment,
  type PlatformInvoicing,
} from '../api/platformInvoicingApi';
import { PLAN_LABELS, formatRon } from '../utils/plans';
import { apiMessage } from '../utils/errors';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Plătită', cls: 'bg-emerald-100 text-emerald-700' },
  PENDING: { label: 'În curs', cls: 'bg-amber-100 text-amber-700' },
  FAILED: { label: 'Eșuată', cls: 'bg-slate-200 text-slate-600' },
};

const dateTime = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}` : '—');

// Adminul: facturile abonamentelor prin FGO (setari) si platile tuturor statiilor, cu emiterea / reemiterea facturii
export default function AdminPaymentsPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Plăți și facturi</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Abonamentele stațiilor și facturile emise de platformă prin FGO</p>
          </div>
        </div>
      </header>
      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6 space-y-6">
        <FgoSettingsCard />
        <PaymentsList />
      </main>
    </div>
  );
}

function FgoSettingsCard() {
  const [saved, setSaved] = useState<PlatformInvoicing | null>(null);
  const [form, setForm] = useState({ cui: '', key: '', series: 'EITP', test: false, markPaid: false, paymentType: 'Card' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const apply = (s: PlatformInvoicing) => {
    setSaved(s);
    setForm({ cui: s.cui ?? '', key: '', series: s.series ?? 'EITP', test: s.test, markPaid: s.markPaid, paymentType: s.paymentType || 'Card' });
  };

  useEffect(() => {
    getPlatformInvoicing()
      .then(apply)
      .catch(() => setMessage({ text: 'Setările nu au putut fi încărcate.', ok: false }));
  }, []);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await action(), ok: true });
    } catch (err) {
      setMessage({ text: apiMessage(err, 'Nu a mers.'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      apply(await savePlatformInvoicing({ ...form, key: form.key.trim() || undefined }));
      return 'Setările au fost salvate.';
    });
  };

  const test = () => run(async () => `Răspunsul FGO: ${(await testPlatformInvoicing()).message}`);

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <Receipt size={16} className="text-blue-600" /> Facturare prin FGO
        </h2>
        {saved && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${saved.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {saved.configured ? (saved.test ? 'Activ · mediu de test' : 'Activ') : 'Nesetat'}
          </span>
        )}
      </div>
      <form onSubmit={save} className="px-5 py-4 space-y-4">
        <p className="text-xs text-slate-500">
          După fiecare plată cu cardul, factura se emite automat în FGO pe datele de facturare ale stației (TVA inclus în preț), cu comanda
          NETOPIA ca număr extern, deci nu se dublează. Trimiterea în SPV o face FGO, după setările din contul FGO. Fără FGO setat, facturile
          se emit prin Oblio (dacă e setat în Render) sau de mână.
        </p>
        {saved?.keyUnreadable && (
          <p className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} /> Cheia salvată nu mai poate fi citită (s-a schimbat JWT_SECRET). Introduceți-o din nou.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="fgo-cui" className="block text-sm font-medium text-slate-600 mb-1">CUI firmă</label>
            <input id="fgo-cui" value={form.cui} onChange={(e) => setForm({ ...form, cui: e.target.value })} placeholder="RO48267925" className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="fgo-series" className="block text-sm font-medium text-slate-600 mb-1">Seria facturilor</label>
            <input id="fgo-series" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} placeholder="EITP" className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="fgo-key" className="block text-sm font-medium text-slate-600 mb-1">Cheia privată API</label>
            <input
              id="fgo-key"
              type="password"
              autoComplete="off"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder={saved?.hasKey && !saved.keyUnreadable ? 'salvată (lăsați gol)' : 'din FGO → Setări → Utilizatori'}
              className={INPUT_CLS}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="fgo-env" checked={!form.test} onChange={() => setForm({ ...form, test: false })} className="text-blue-600" />
            Producție (api.fgo.ro)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="fgo-env" checked={form.test} onChange={() => setForm({ ...form, test: true })} className="text-blue-600" />
            Test (cont separat pe testuat.fgo.ro)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.markPaid} onChange={(e) => setForm({ ...form, markPaid: e.target.checked })} className="rounded border-slate-300 text-blue-600" />
            Marchează factura încasată
          </label>
          {form.markPaid && (
            <input
              value={form.paymentType}
              onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
              aria-label="Tipul încasării în FGO"
              placeholder="Card"
              className={INPUT_CLS + ' w-40'}
            />
          )}
          <span className="text-xs text-slate-400">Încasarea prin API merge doar pe FGO Premium / Enterprise.</span>
        </div>
        {message && (
          <p className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${message.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
            {message.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Salvează
          </button>
          <button type="button" onClick={test} disabled={busy || !saved?.configured} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Testează conexiunea
          </button>
          {saved?.hasKey && (
            <button
              type="button"
              onClick={() => run(async () => (apply(await removePlatformKey()), 'Cheia a fost ștearsă; facturarea prin FGO e oprită.'))}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Șterge cheia
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          La „Testează conexiunea”, FGO caută factura nr. 0: un răspuns că factura nu există înseamnă că datele sunt bune. „Codul unic nu
          există sau nu este asociat” = CUI-ul nu e cel din contul FGO al acestui mediu (testul și producția sunt conturi separate); o eroare
          de hash = cheie greșită. Scrieți CUI-ul exact ca în contul FGO.
        </p>
      </form>
    </section>
  );
}

function PaymentsList() {
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ orderId: string; text: string } | null>(null);

  const load = useCallback(() => {
    getAdminPayments()
      .then((r) => {
        setRows(r);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async (orderId: string) => {
    setBusy(orderId);
    setRowError(null);
    try {
      const res = await issuePaymentInvoice(orderId);
      setRows((rs) => rs?.map((r) => (r.payment.orderId === orderId ? { ...r, payment: res.payment, invoiceError: res.invoiceError } : r)) ?? null);
    } catch (err) {
      setRowError({ orderId, text: apiMessage(err, 'Factura nu a putut fi emisă.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <FileText size={16} className="text-blue-600" /> Plăți
        </h2>
        <button type="button" onClick={load} aria-label="Reîncarcă" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600">
          <RefreshCw size={15} />
        </button>
      </div>
      {error ? (
        <p className="m-5 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={15} /> Plățile nu au putut fi încărcate.
        </p>
      ) : !rows ? (
        <div className="py-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Nicio plată încă.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(({ station, payment: p, invoiceError }) => (
            <li key={p.orderId} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {station} <span className="font-normal text-slate-500">· {PLAN_LABELS[p.plan]}{p.smsPlan ? ` + ${p.smsPlan} SMS` : ''} · {p.months === 1 ? '1 lună' : `${p.months} luni`}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {dateTime(p.paidAt ?? p.createdAt)} · comanda {p.orderId}
                </p>
                {invoiceError && <p className="mt-1 text-xs text-red-600">{invoiceError}</p>}
                {rowError?.orderId === p.orderId && <p className="mt-1 text-xs text-red-600">{rowError.text}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold tabular-nums text-slate-800">{formatRon(p.amount)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[p.status]?.cls ?? ''}`}>{STATUS[p.status]?.label ?? p.status}</span>
                {p.invoiceNumber ? (
                  p.invoiceLink ? (
                    <a href={p.invoiceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                      {p.invoiceNumber} <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-700">{p.invoiceNumber}</span>
                  )
                ) : (
                  p.status === 'PAID' && (
                    <button
                      type="button"
                      onClick={() => issue(p.orderId)}
                      disabled={busy === p.orderId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busy === p.orderId && <Loader2 size={12} className="animate-spin" />}
                      {invoiceError ? 'Reîncearcă factura' : 'Emite factura'}
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
