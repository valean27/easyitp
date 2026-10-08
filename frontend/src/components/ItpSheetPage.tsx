import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import type { DashboardEntry, Profile } from '../types';
import { getProfile } from '../api/accountApi';
import { getItp } from '../api/itpApi';
import { bookingUrl } from '../utils/booking';
import { STATUS_LABELS, formatDateRo } from '../utils/fleet';
import { useQr } from '../utils/qr';
import { assetUrl } from '../utils/apiUrl';

const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

const STATUS_COLOR: Record<DashboardEntry['status'], string> = {
  PASSED: '#047857',
  FAILED: '#b91c1c',
  RECHECK: '#b45309',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: '4mm', padding: '2mm 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ width: '45mm', flexShrink: 0, color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Fisa ITP pentru client (A4, de tiparit): masina, rezultatul, urmatorul ITP si un QR spre programarea online.
// Nu e chitanta (fara pret) si nu inlocuieste documentele oficiale ale inspectiei.
export default function ItpSheetPage() {
  const { id } = useParams();
  const [entry, setEntry] = useState<DashboardEntry | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getItp(Number(id)), getProfile()])
      .then(([e, p]) => {
        setEntry(e);
        setProfile(p);
      })
      .catch(() => setError(true));
  }, [id]);

  const booking = profile?.bookingEnabled && profile.bookingSlug ? bookingUrl(profile.bookingSlug) : null;
  const qr = useQr(booking);

  if (error) return <p className="p-6 text-sm text-red-600">Fișa nu a putut fi încărcată.</p>;
  if (!entry || !profile) {
    return (
      <div className="p-6 flex items-center text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
      </div>
    );
  }

  const car = [entry.marca, entry.model].filter(Boolean).join(' ');
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden max-w-[210mm] mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft size={16} /> Înapoi
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          <Printer size={16} /> Tipărește
        </button>
      </div>

      <div
        className="poster mx-auto shadow-lg print:shadow-none"
        style={{ width: '210mm', minHeight: '297mm', background: '#ffffff', color: INK, padding: '16mm 16mm', fontSize: '11pt' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8mm', borderBottom: `2px solid ${INK}`, paddingBottom: '5mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4mm' }}>
            {profile.logoUrl && (
              <img src={assetUrl(profile.logoUrl)} alt="" style={{ height: '16mm', width: 'auto', maxWidth: '40mm', objectFit: 'contain' }} />
            )}
            <div>
              <p style={{ fontSize: '16pt', fontWeight: 800 }}>{profile.stationName || 'Stația ITP'}</p>
              <p style={{ color: MUTED }}>{[profile.address, profile.phone].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '16pt', fontWeight: 800 }}>Fișă ITP</p>
            <p style={{ color: MUTED }}>{formatDateRo(entry.dataItp)}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6mm', margin: '8mm 0' }}>
          <div>
            <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '22pt', fontWeight: 800, letterSpacing: '0.04em' }}>
              {entry.numarInmatriculare.toUpperCase()}
            </p>
            <p style={{ fontSize: '13pt', color: MUTED }}>{car}</p>
          </div>
          <span
            style={{ fontSize: '14pt', fontWeight: 800, color: STATUS_COLOR[entry.status], border: `2px solid ${STATUS_COLOR[entry.status]}`, borderRadius: '3mm', padding: '2mm 5mm' }}
          >
            {STATUS_LABELS[entry.status]}
          </span>
        </div>

        <div style={{ border: `2px solid ${INK}`, borderRadius: '4mm', padding: '5mm 6mm', marginBottom: '8mm' }}>
          <p style={{ color: MUTED }}>Următorul ITP</p>
          <p style={{ fontSize: '24pt', fontWeight: 800 }}>{formatDateRo(entry.dataUrmatorItp)}</p>
          <p style={{ color: MUTED }}>Valabilitate {entry.valabilitateLuni} {entry.valabilitateLuni === 1 ? 'lună' : 'luni'}</p>
        </div>

        <Row label="Proprietar" value={entry.numeSofer} />
        <Row label="Telefon" value={entry.contact} />
        <Row label="Vehicul" value={car} />
        <Row label="An fabricație" value={entry.year} />
        <Row label="VIN" value={entry.vin && <span style={{ fontFamily: 'ui-monospace, monospace' }}>{entry.vin}</span>} />
        <Row label="Kilometraj" value={entry.mileage != null ? `${entry.mileage.toLocaleString('ro-RO')} km` : null} />
        <Row label="Data inspecției" value={formatDateRo(entry.dataItp)} />
        <Row label="Inspector" value={entry.inspector} />

        {entry.observations && (
          <div style={{ marginTop: '6mm' }}>
            <p style={{ color: MUTED, marginBottom: '1.5mm' }}>Observații</p>
            <p style={{ whiteSpace: 'pre-wrap', border: `1px solid ${LINE}`, borderRadius: '3mm', padding: '4mm' }}>{entry.observations}</p>
          </div>
        )}

        {qr && booking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6mm', marginTop: '10mm', border: `1px solid ${LINE}`, borderRadius: '4mm', padding: '5mm' }}>
            <div style={{ width: '30mm', height: '30mm', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: qr }} />
            <div>
              <p style={{ fontSize: '13pt', fontWeight: 700 }}>Programați următorul ITP online</p>
              <p style={{ color: MUTED }}>Scanați codul sau intrați pe {booking.replace(/^https?:\/\//, '')}</p>
            </div>
          </div>
        )}

        <p style={{ marginTop: '10mm', fontSize: '9pt', color: MUTED }}>
          Fișă informativă emisă de stație. Nu înlocuiește documentele oficiale ale inspecției tehnice periodice.
        </p>
      </div>
    </div>
  );
}
