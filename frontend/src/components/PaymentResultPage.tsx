import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import { refreshPayment, type Payment } from '../api/billingApi';
import { usePlan } from '../context/plan';
import { formatDateRo } from '../utils/fleet';
import { PLAN_LABELS } from '../utils/plans';
import { COMPANY } from '../utils/company';

// Intoarcerea din pagina de plata Netopia (/plata?order=...): verificam plata la server, de cateva ori daca e inca in curs
export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { reload } = usePlan();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [failed, setFailed] = useState(false);
  // dupa cateva verificari pe "in curs" ne oprim; butonul porneste o noua serie
  const [round, setRound] = useState(0);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let tries = 0;
    setPolling(true);
    const check = () => {
      refreshPayment(orderId)
        .then((p) => {
          if (cancelled) return;
          setPayment(p);
          if (p.status === 'PAID') reload();
          if (p.status === 'PENDING' && ++tries < 6) setTimeout(check, 3000);
          else setPolling(false);
        })
        .catch(() => {
          if (!cancelled) {
            setFailed(true);
            setPolling(false);
          }
        });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [orderId, reload, round]);

  let icon = <Loader2 size={40} className="animate-spin text-blue-600" />;
  let title = 'Verificăm plata...';
  let text = 'Durează câteva secunde.';
  if (!orderId || failed) {
    icon = <XCircle size={40} className="text-red-500" />;
    title = 'Nu am găsit plata';
    text = `Verificați în Contul meu → Abonament. Dacă suma a fost retrasă, scrieți-ne la ${COMPANY.email}${
      orderId ? ` cu numărul comenzii ${orderId}` : ''
    } și o rezolvăm.`;
  } else if (payment?.status === 'PAID') {
    icon = <CheckCircle2 size={40} className="text-emerald-600" />;
    title = 'Plata a reușit. Mulțumim!';
    text = `Pachetul ${PLAN_LABELS[payment.plan]} este activ până la ${formatDateRo(payment.planUntil)}.`;
  } else if (payment?.status === 'FAILED') {
    icon = <XCircle size={40} className="text-red-500" />;
    title = 'Plata nu a reușit';
    text = 'Cardul nu a fost debitat. Puteți încerca din nou din Contul meu → Abonament.';
  } else if (payment) {
    icon = <Clock size={40} className="text-amber-500" />;
    title = 'Plata este în curs';
    text = 'Netopia încă o procesează. Pachetul se activează singur când plata e confirmată; puteți închide pagina.';
  }
  const canRecheck = !!orderId && !polling && (failed || payment?.status === 'PENDING');

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-100 shadow-sm p-8 text-center">
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{text}</p>
        {payment?.invoiceLink && (
          <a href={payment.invoiceLink} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
            Vezi factura {payment.invoiceNumber}
          </a>
        )}
        {canRecheck && (
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRound((r) => r + 1);
            }}
            className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
          >
            Verifică din nou
          </button>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/account#abonament" className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Abonament
          </Link>
          <Link to="/" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Înapoi la stație
          </Link>
        </div>
      </div>
    </div>
  );
}
