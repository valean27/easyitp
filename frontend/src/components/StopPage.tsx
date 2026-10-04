import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BellOff, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { confirmStop, getStopInfo, type StopInfo } from '../api/publicApi';

// Pagina din link-ul STOP al mesajelor (fara login): clientul nu mai vrea remindere de la statie
export default function StopPage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<StopInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getStopInfo(token)
      .then(setInfo)
      .catch(() => setInvalid(true));
  }, [token]);

  const stop = async () => {
    setBusy(true);
    setError(false);
    try {
      setInfo(await confirmStop(token));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const station = info?.stationName || 'stația ITP';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center space-y-4">
        {invalid ? (
          <>
            <AlertTriangle size={36} className="mx-auto text-amber-500" />
            <h1 className="text-lg font-bold text-slate-800">Link invalid</h1>
            <p className="text-sm text-slate-500">Link-ul nu mai este valabil. Pentru dezabonare contactați direct stația ITP.</p>
          </>
        ) : !info ? (
          <Loader2 size={28} className="mx-auto animate-spin text-slate-400" />
        ) : info.stopped ? (
          <>
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h1 className="text-lg font-bold text-slate-800">Gata, nu mai primiți mesaje</h1>
            <p className="text-sm text-slate-500">
              {station} nu vă mai trimite remindere pentru ITP. Dacă vă răzgândiți, spuneți-le la următoarea vizită.
            </p>
          </>
        ) : (
          <>
            <BellOff size={36} className="mx-auto text-slate-400" />
            <h1 className="text-lg font-bold text-slate-800">Dezabonare de la remindere</h1>
            <p className="text-sm text-slate-500">
              Nu mai doriți mesaje de la <span className="font-medium text-slate-700">{station}</span> despre expirarea ITP-ului?
            </p>
            {error && <p className="text-sm text-red-600">Nu a mers. Încercați din nou.</p>}
            <button
              onClick={stop}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Nu mai doresc mesaje
            </button>
          </>
        )}
      </div>
    </div>
  );
}
