import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Undo2, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { undoEvent } from '../api/historyApi';
import { UNDO_VISIBLE_MS, currentUndo, dismissUndo, subscribeUndo, type UndoOffer } from '../utils/undo';
import { apiMessage } from '../utils/errors';

type Result = { text: string; ok: boolean } | null;

// Bara de jos dupa o stergere: "ITP șters · Anulează" (10 secunde); stergerea ramane si in pagina Istoric
export default function UndoToast() {
  const [offer, setOffer] = useState<UndoOffer | null>(currentUndo);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  useEffect(
    () =>
      subscribeUndo((next) => {
        setOffer(next);
        if (next) setResult(null);
      }),
    []
  );

  useEffect(() => {
    if (!offer) return;
    const t = setTimeout(() => dismissUndo(offer.key), UNDO_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [offer]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(t);
  }, [result]);

  const undo = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const message = await undoEvent(offer.eventId);
      offer.onUndone?.();
      setResult({ text: message, ok: true });
    } catch (err) {
      setResult({ text: apiMessage(err, 'Ștergerea nu a putut fi anulată.'), ok: false });
    } finally {
      setBusy(false);
      dismissUndo(offer.key);
    }
  };

  if (!offer && !result) return null;
  const base =
    'fixed bottom-20 md:bottom-6 inset-x-4 mx-auto w-fit max-w-[calc(100vw-2rem)] z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium';

  if (!offer && result) {
    return (
      <div role="status" className={`${base} ${result.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
        {result.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        <span>{result.text}</span>
      </div>
    );
  }

  return (
    <div role="status" className={`${base} bg-[#1e293b] text-white ring-1 ring-white/10`}>
      <span>{offer!.message}</span>
      <button
        onClick={undo}
        disabled={busy}
        className="flex items-center gap-1.5 font-semibold text-[#93c5fd] hover:text-white disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
        Anulează
      </button>
      <Link to="/history" onClick={() => dismissUndo(offer!.key)} className="hidden sm:inline text-[#cbd5e1] hover:text-white underline-offset-2 hover:underline">
        Istoric
      </Link>
      <button onClick={() => dismissUndo(offer!.key)} className="text-[#94a3b8] hover:text-white" title="Închide">
        <X size={15} />
      </button>
    </div>
  );
}
