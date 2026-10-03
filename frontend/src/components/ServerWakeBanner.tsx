import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { isSlow, subscribeSlow } from '../utils/serverStatus';

// Apare doar cand o cerere dureaza neobisnuit de mult (de obicei serverul se trezeste dupa inactivitate)
export default function ServerWakeBanner() {
  const [slow, setSlow] = useState(isSlow);

  useEffect(() => subscribeSlow(setSlow), []);

  if (!slow) return null;
  return (
    <div
      role="status"
      className="fixed top-3 inset-x-4 mx-auto w-fit z-[100] flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-2 shadow-lg"
    >
      <Loader2 size={15} className="animate-spin shrink-0" />
      Serverul pornește, poate dura până la un minut…
    </div>
  );
}
