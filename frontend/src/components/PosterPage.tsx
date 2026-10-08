import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import type { Profile } from '../types';
import { getProfile } from '../api/accountApi';
import { bookingUrl } from '../utils/booking';
import { useQr } from '../utils/qr';
import { assetUrl } from '../utils/apiUrl';

// Fara "https://" pe afis: mai scurt de citit si de tastat
const shortUrl = (url: string) => url.replace(/^https?:\/\//, '');

// Afisul A4 pentru stație: QR spre programarea online (si, optional, spre recenzii). Culorile sunt fixe, ca la tiparire
// sa iasa la fel si in modul intunecat.
export default function PosterPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setError(true));
  }, []);

  const booking = profile?.bookingEnabled && profile.bookingSlug ? bookingUrl(profile.bookingSlug) : null;
  const bookingQr = useQr(booking);
  const reviewQr = useQr(profile?.reviewUrl ?? null);

  if (error) return <p className="p-6 text-sm text-red-600">Datele stației nu au putut fi încărcate.</p>;
  if (!profile) {
    return (
      <div className="p-6 flex items-center text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden max-w-[210mm] mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft size={16} /> Contul meu
        </Link>
        <button
          onClick={() => window.print()}
          disabled={!booking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          <Printer size={16} /> Tipărește
        </button>
        {!booking && (
          <p className="w-full text-sm text-amber-700">
            Porniți programarea online (Contul meu → Programări online) ca afișul să aibă codul QR.
          </p>
        )}
      </div>

      <div
        className="poster mx-auto shadow-lg print:shadow-none flex flex-col items-center text-center"
        style={{ width: '210mm', minHeight: '297mm', background: '#ffffff', color: '#0f172a', padding: '18mm 16mm' }}
      >
        {profile.logoUrl && (
          <img src={assetUrl(profile.logoUrl)} alt="" style={{ height: '28mm', width: 'auto', maxWidth: '80mm', objectFit: 'contain', marginBottom: '5mm' }} />
        )}
        <p style={{ fontSize: '15pt', fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {profile.stationName || 'Stația ITP'}
        </p>
        <h1 style={{ fontSize: '36pt', fontWeight: 800, lineHeight: 1.1, marginTop: '8mm' }}>
          Programează-te
          <br />
          online la ITP
        </h1>
        <p style={{ fontSize: '15pt', color: '#475569', marginTop: '5mm' }}>
          Scanează codul cu camera telefonului, alege ziua și ora. Fără telefoane, fără așteptare.
        </p>

        {bookingQr && (
          <div
            style={{ width: '105mm', height: '105mm', marginTop: '10mm', border: '2px solid #e2e8f0', borderRadius: '6mm', padding: '4mm' }}
            dangerouslySetInnerHTML={{ __html: bookingQr }}
          />
        )}
        {booking && <p style={{ fontSize: '14pt', fontWeight: 600, marginTop: '5mm', wordBreak: 'break-all' }}>{shortUrl(booking)}</p>}

        <div style={{ marginTop: 'auto', paddingTop: '10mm', width: '100%' }}>
          {reviewQr && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6mm', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '5mm', padding: '5mm', marginBottom: '8mm' }}
            >
              <div style={{ width: '32mm', height: '32mm', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: reviewQr }} />
              <div>
                <p style={{ fontSize: '15pt', fontWeight: 700 }}>Ați fost mulțumit?</p>
                <p style={{ fontSize: '12pt', color: '#475569' }}>Scanați și lăsați-ne o recenzie pe Google. Ne ajută mult!</p>
              </div>
            </div>
          )}
          <p style={{ fontSize: '14pt', fontWeight: 600 }}>{[profile.phone, profile.address].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </div>
  );
}
