import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { usePlan } from '../context/plan';
import { getPayments, startCheckout, updateBillingDetails, type BillingDetails, type Payment } from '../api/billingApi';
import { apiMessage } from '../utils/errors';
import { formatDateRo } from '../utils/fleet';
import { SMS_PLANS } from '../utils/smsPlans';
import { COMPANY } from '../utils/company';
import {
  PLANS,
  PLAN_LABELS,
  VAT_PERCENT,
  amountWithVat,
  billedMonths,
  formatRon,
  monthlyPrice,
  paidUntil,
  planPrice,
  smsPrice,
  type PlanName,
} from '../utils/plans';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const STATUS_LABELS: Record<Payment['status'], string> = { PENDING: 'În curs', PAID: 'Plătită', FAILED: 'Eșuată' };

const EMPTY_DETAILS: BillingDetails = { name: '', cui: '', address: '', city: '', county: '' };

// Contul meu → Abonament: pachetul de azi, alegerea pachetului (+ SMS incluse, 1 sau 12 luni), datele de facturare,
// plata cu cardul prin Netopia si platile anterioare cu factura
export default function SubscriptionCard() {
  const { status, reload } = usePlan();
  const [plan, setPlan] = useState<PlanName>('PRO');
  const [sms, setSms] = useState(0);
  const [months, setMonths] = useState(1);
  const [details, setDetails] = useState<BillingDetails>(EMPTY_DETAILS);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // acordul cu termenii (plata, livrarea, anularea) inainte de plata, cerut de NETOPIA Payments
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!status) return;
    setDetails({ ...EMPTY_DETAILS, ...Object.fromEntries(Object.entries(status.billing).map(([k, v]) => [k, v ?? ''])) });
    if (status.paidPlan !== 'FREE' && !status.trial) {
      setPlan(status.paidPlan);
      setSms(status.smsPlan);
    }
  }, [status]);

  useEffect(() => {
    getPayments()
      .then(setPayments)
      .catch(() => setPayments([]));
  }, []);

  if (!status) {
    return (
      <SettingsCard id="abonament" icon={<CreditCard size={15} />} title="Abonament">
        <div className="px-6 py-5 flex items-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
        </div>
      </SettingsCard>
    );
  }

  const current = PLAN_LABELS[status.plan];
  const summary = status.trial
    ? `Probă Premium până la ${formatDateRo(status.planUntil)}`
    : status.plan === 'FREE'
      ? 'Gratuit'
      : status.planUntil
        ? `${current}${status.smsPlan ? ` + ${status.smsPlan} SMS` : ''} · plătit până la ${formatDateRo(status.planUntil)}`
        : current;

  const set = (k: keyof BillingDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setDetails((d) => ({ ...d, [k]: e.target.value }));
  };

  const saveDetails = async () => {
    setError(null);
    setBusy(true);
    try {
      await updateBillingDetails(details);
      setSaved(true);
      reload();
      return true;
    } catch (err) {
      setError(apiMessage(err, 'Datele de facturare nu au putut fi salvate.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!accepted) {
      setError('Bifați acordul cu termenii ca să continuați.');
      return;
    }
    if (!(await saveDetails())) return;
    setBusy(true);
    try {
      const { paymentUrl } = await startCheckout(plan, sms, months);
      window.location.assign(paymentUrl);
    } catch (err) {
      setError(apiMessage(err, 'Plata nu a putut fi pornită.'));
      setBusy(false);
    }
  };

  const total = amountWithVat(plan, sms, months);
  const net = monthlyPrice(plan, sms) * billedMonths(months);
  const until = paidUntil(status, plan, sms, months, new Date().toLocaleDateString('sv-SE'));
  const changing = !status.trial && status.plan !== 'FREE' && status.planUntil && (status.paidPlan !== plan || status.smsPlan !== sms);

  return (
    <SettingsCard id="abonament" icon={<CreditCard size={15} />} title="Abonament" summary={summary}>
      <div className="px-6 py-5 space-y-5">
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-700">
          Pachetul de azi: <b>{current}</b>
          {status.trial && status.daysLeft !== null && <> · probă, mai aveți {Math.max(0, status.daysLeft)} zile</>}
          {status.plan === 'FREE' && status.paidPlan !== 'FREE' && (
            <> · abonamentul {PLAN_LABELS[status.paidPlan]} a expirat, datele sunt păstrate</>
          )}
          {status.plan !== 'FREE' && !status.trial && !status.planUntil && <> · fără dată de expirare</>}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-800">Alegeți pachetul</p>
            <div role="radiogroup" aria-label="Perioada" className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
              {[1, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={months === m}
                  onClick={() => setMonths(m)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${months === m ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m === 1 ? 'Lunar' : 'Anual · 2 luni gratuite'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLANS.filter((p) => p.name !== 'FREE').map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPlan(p.name)}
                aria-pressed={plan === p.name}
                className={`h-full flex flex-col justify-start text-left rounded-xl border p-4 transition-colors ${
                  plan === p.name ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="w-full flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-slate-900">{PLAN_LABELS[p.name]}</span>
                  {current === PLAN_LABELS[p.name] && !status.trial && status.planUntil && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Pachetul actual</span>
                  )}
                </span>
                <span className="mt-1 block">
                  {months === 1 ? (
                    <span className="text-lg font-extrabold text-slate-900">{p.price} RON<span className="text-xs font-medium text-slate-500"> / lună</span></span>
                  ) : (
                    <>
                      <span className="text-lg font-extrabold text-slate-900">{formatRon(p.price * 10)}<span className="text-xs font-medium text-slate-500"> / an</span></span>
                      <span className="block text-xs text-slate-500">
                        <s>{formatRon(p.price * 12)}</s> · {formatRon(Math.round((p.price * 1000) / 12) / 100)} / lună
                      </span>
                    </>
                  )}
                  <span className="block text-[11px] text-slate-400">fără TVA</span>
                </span>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {p.points.slice(1).map((pt) => (
                    <li key={pt} className="flex gap-1.5">
                      <Check size={13} className="mt-0.5 shrink-0 text-blue-600" /> {pt}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Pachetul Gratuit rămâne mereu disponibil: după expirare stația trece singură pe el, fără să piardă date.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">SMS-uri incluse (opțional)</p>
          <p className="text-xs text-slate-500 mb-2">
            Fără pachet, mesajele automate pleacă de pe telefonul stației. Cu pachet, pleacă din numărul platformei, fără telefon.
          </p>
          <div role="radiogroup" aria-label="SMS-uri incluse" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ sms: 0, price: 0 }, ...SMS_PLANS].map((o) => (
              <button
                key={o.sms}
                type="button"
                role="radio"
                aria-checked={sms === o.sms}
                onClick={() => setSms(o.sms)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  sms === o.sms ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-800">{o.sms ? `${o.sms} SMS` : 'Fără'}</span>
                <span className="block text-xs text-slate-500">{o.sms ? `+${o.price} RON / lună` : 'telefonul stației'}</span>
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-800 mb-1">Date de facturare</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={INPUT_CLS} placeholder="Firma (ex. ITP Exemplu SRL)" value={details.name ?? ''} onChange={set('name')} aria-label="Firma" />
            <input className={INPUT_CLS} placeholder="CUI (ex. RO12345678)" value={details.cui ?? ''} onChange={set('cui')} aria-label="CUI" />
            <input className={`${INPUT_CLS} sm:col-span-2`} placeholder="Adresa sediului" value={details.address ?? ''} onChange={set('address')} aria-label="Adresa" />
            <input className={INPUT_CLS} placeholder="Oraș" value={details.city ?? ''} onChange={set('city')} aria-label="Oraș" />
            <input className={INPUT_CLS} placeholder="Județ" value={details.county ?? ''} onChange={set('county')} aria-label="Județ" />
          </div>
          {saved && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 size={13} /> Datele de facturare au fost salvate.
            </p>
          )}
        </fieldset>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600">
                {PLAN_LABELS[plan]} · {months === 1 ? '1 lună' : '12 luni'}
              </dt>
              <dd className="tabular-nums text-slate-800">{formatRon(planPrice(plan) * months)}</dd>
            </div>
            {sms > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">
                  {sms} SMS / lună · {months === 1 ? '1 lună' : '12 luni'}
                </dt>
                <dd className="tabular-nums text-slate-800">{formatRon(smsPrice(sms) * months)}</dd>
              </div>
            )}
            {months === 12 && (
              <div className="flex justify-between gap-3 text-emerald-700">
                <dt>2 luni gratuite</dt>
                <dd className="tabular-nums">−{formatRon(monthlyPrice(plan, sms) * 2)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600">TVA {VAT_PERCENT}%</dt>
              <dd className="tabular-nums text-slate-800">{formatRon(Math.round((total - net) * 100) / 100)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
              <dt className="font-semibold text-slate-800">Total</dt>
              <dd className="text-xl font-extrabold text-slate-900 tabular-nums">{formatRon(total)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            Activ până la <b className="text-slate-700">{formatDateRo(until)}</b> inclusiv. Nu se reînnoiește automat: vă anunțăm pe email cu 3 zile înainte.
          </p>
          {changing && (
            <p className="text-xs text-slate-500">
              Noul pachet începe azi; zilele rămase din cel actual se transformă în zile din cel nou, după preț.
            </p>
          )}
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {status.paymentsAvailable && (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  setError(null);
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Am citit și accept{' '}
                <Link to="/termeni#plata" target="_blank" className="font-semibold text-blue-600 hover:underline">termenii</Link>, inclusiv
                plata, livrarea serviciului și{' '}
                <Link to="/termeni#anulare" target="_blank" className="font-semibold text-blue-600 hover:underline">anularea</Link>.
              </span>
            </label>
          )}
          {status.paymentsAvailable ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={pay}
                disabled={busy}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                Plătește cu cardul
              </button>
              <button
                type="button"
                onClick={saveDetails}
                disabled={busy}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Salvează doar datele
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Plata online cu cardul se activează în curând. Până atunci, scrieți-ne la{' '}
                <a href={`mailto:${COMPANY.email}`} className="font-semibold text-blue-600 hover:underline">{COMPANY.email}</a> sau sunați la{' '}
                <a href={COMPANY.phoneHref} className="font-semibold text-blue-600 hover:underline">{COMPANY.phone}</a> și activăm pachetul
                cu plata prin transfer bancar.
              </p>
              <button
                type="button"
                onClick={saveDetails}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Salvează datele de facturare
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <img src="/legal/netopia-visa-mastercard.png" alt="NETOPIA Payments, Visa, Mastercard" width={159} height={30} className="rounded border border-slate-200" />
            <p className="flex-1 min-w-[12rem] text-xs text-slate-400">
              Plata se face pe pagina securizată NETOPIA Payments. Factura apare mai jos după plată.{' '}
              <Link to="/retragere" className="underline">Retrageți-vă din contract aici</Link>.
            </p>
          </div>
        </div>

        {payments.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Plăți</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {payments.map((p) => (
                <li key={p.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="text-slate-500 tabular-nums">{formatDateRo(p.createdAt.slice(0, 10))}</span>
                  <span className="flex-1 min-w-0 text-slate-700">
                    {PLAN_LABELS[p.plan]}
                    {p.smsPlan ? ` + ${p.smsPlan} SMS` : ''} · {p.months === 1 ? '1 lună' : `${p.months} luni`}
                  </span>
                  <span className="tabular-nums font-medium text-slate-800">{formatRon(p.amount)}</span>
                  <span
                    className={`text-xs font-semibold ${
                      p.status === 'PAID' ? 'text-emerald-700' : p.status === 'FAILED' ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                  {p.invoiceLink && (
                    <a href={p.invoiceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                      {p.invoiceNumber ?? 'Factura'} <ExternalLink size={12} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
