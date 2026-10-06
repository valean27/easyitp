import { Link, useLocation } from 'react-router-dom';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { usePlan } from '../context/plan';
import { PLAN_LABELS } from '../utils/plans';

// Banda de sus: proba Premium (zile ramase), abonament aproape de expirare sau expirat (stația e pe Gratuit)
export default function PlanBanner() {
  const { status } = usePlan();
  const { pathname } = useLocation();
  if (!status || pathname === '/account') return null;

  const expired = status.plan === 'FREE' && status.paidPlan !== 'FREE';
  const days = status.daysLeft;
  let text: string | null = null;
  if (expired) {
    text = `Abonamentul ${PLAN_LABELS[status.paidPlan]} a expirat: stația folosește acum pachetul Gratuit. Datele sunt păstrate.`;
  } else if (status.trial && days !== null) {
    text = days <= 0 ? 'Ultima zi de probă Premium.' : `Probă Premium: mai aveți ${days} ${days === 1 ? 'zi' : 'zile'}.`;
  } else if (days !== null && days <= 7) {
    text = `Abonamentul ${PLAN_LABELS[status.plan]} expiră ${days <= 0 ? 'azi' : `în ${days} ${days === 1 ? 'zi' : 'zile'}`}.`;
  }
  if (!text) return null;

  const warn = expired || (days !== null && days <= 3);
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${
        warn ? 'bg-amber-50 text-amber-800 border-b border-amber-200' : 'bg-blue-50 text-blue-800 border-b border-blue-100'
      }`}
    >
      {warn ? <AlertTriangle size={15} className="shrink-0" /> : <Sparkles size={15} className="shrink-0" />}
      <span>{text}</span>
      <Link to="/account#abonament" className="font-semibold underline underline-offset-2">
        {status.trial || expired ? 'Alegeți pachetul' : 'Prelungiți'}
      </Link>
    </div>
  );
}
