import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Loader2, ExternalLink } from 'lucide-react';
import type { Invoice } from '../types';
import { getInvoicingSettings } from '../api/invoicingApi';
import { apiMessage } from '../utils/errors';

const ron = (v: number) => `${v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`;

// Factura Oblio pentru ceva anume (centralizatorul unei luni sau un ITP): o arata daca exista, altfel butonul de emitere.
// Fara facturare configurata: un link spre setari. `load` se apeleaza o singura data (la montare).
export default function InvoiceButton({
  load,
  issue,
  confirmText,
  label = 'Emite factura în Oblio',
}: {
  load: () => Promise<Invoice | null>;
  issue: () => Promise<Invoice>;
  confirmText: string;
  label?: string;
}) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInvoicingSettings()
      .then((s) => {
        if (cancelled) return;
        setReady(s.ready);
        if (s.ready) load().then((i) => !cancelled && setInvoice(i)).catch(() => !cancelled && setInvoice(null));
      })
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
    // o singura data: pentru alta luna / alt ITP componenta se monteaza din nou (key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready === null) return null;
  if (!ready) {
    return (
      <p className="text-xs text-slate-400">
        Facturi direct în Oblio:{' '}
        <Link to="/account#facturare" className="text-blue-600 hover:underline">
          configurează facturarea
        </Link>
      </p>
    );
  }
  if (invoice === undefined) return <Loader2 size={15} className="animate-spin text-slate-400" />;

  if (invoice) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
          <Receipt size={15} /> Factura {invoice.seriesName} {invoice.number} · {ron(invoice.total)}
        </span>
        {invoice.link && (
          <a href={invoice.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            Deschide <ExternalLink size={13} />
          </a>
        )}
        {invoice.einvoiceStatus && <span className="text-xs text-slate-500">{invoice.einvoiceStatus}</span>}
      </div>
    );
  }

  const run = async () => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      setInvoice(await issue());
    } catch (err) {
      setError(apiMessage(err, 'Factura nu a putut fi emisă.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />} {label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
