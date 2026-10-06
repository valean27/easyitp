import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { usePlan } from '../context/plan';
import { FEATURE_PLAN, PLAN_LABELS, type Feature } from '../utils/plans';

// Mesajul pentru o functie care nu e in pachetul statiei, cu link spre Contul meu → Abonament.
// Nu apare nimic daca functia e inclusa.
export default function PlanLock({ feature, text, className = '' }: { feature: Feature; text?: string; className?: string }) {
  const { has } = usePlan();
  if (has(feature)) return null;
  const plan = PLAN_LABELS[FEATURE_PLAN[feature]];
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}>
      <Lock size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{text ?? `Funcția face parte din pachetul ${plan}.`}</p>
        <Link to="/account#abonament" className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline">
          <Sparkles size={14} /> Treceți pe {plan}
        </Link>
      </div>
    </div>
  );
}

// Eticheta mica „Pro” / „Premium” langa un buton blocat
export function PlanBadge({ feature }: { feature: Feature }) {
  const { has } = usePlan();
  if (has(feature)) return null;
  return (
    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
      {PLAN_LABELS[FEATURE_PLAN[feature]]}
    </span>
  );
}
