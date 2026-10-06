import { createContext, useContext } from 'react';
import type { BillingStatus } from '../api/billingApi';
import type { Feature } from '../utils/plans';

// Abonamentul statiei logate (PlanProvider in Layout). Cat timp nu s-a incarcat, functiile apar deblocate
// (serverul refuza oricum ce nu e in pachet), ca sa nu clipeasca lacatele la fiecare pagina.
export interface PlanContextType {
  status: BillingStatus | null;
  has: (feature: Feature) => boolean;
  reload: () => void;
}

export const PlanContext = createContext<PlanContextType>({ status: null, has: () => true, reload: () => {} });

export function usePlan() {
  return useContext(PlanContext);
}
