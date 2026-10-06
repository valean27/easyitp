import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBillingStatus, type BillingStatus } from '../api/billingApi';
import { useAuth } from './auth';
import { PlanContext } from './plan';
import type { Feature } from '../utils/plans';

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const manager = user?.role === 'MANAGER';

  const reload = useCallback(() => {
    if (!manager) return;
    getBillingStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [manager]);

  useEffect(reload, [reload]);

  const value = useMemo(
    () => ({
      status,
      has: (feature: Feature) => !manager || !status || status.features.includes(feature),
      reload,
    }),
    [status, manager, reload],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
