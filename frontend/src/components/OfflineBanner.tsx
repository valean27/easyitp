import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Banda de sus cand dispozitivul nu are internet; programarile de azi se vad din copia salvata
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-slate-800 px-4 py-1.5 text-xs text-white">
      <WifiOff size={13} className="shrink-0" />
      Fără internet: vedeți programările de azi salvate pe dispozitiv; pentru modificări e nevoie de conexiune.
    </div>
  );
}
