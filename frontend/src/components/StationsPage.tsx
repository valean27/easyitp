import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Phone, Clock, CalendarCheck, Loader2, AlertTriangle, Building2, Navigation } from 'lucide-react';
import { getPublicStations, type PublicStationSummary } from '../api/publicApi';
import { WEEKDAYS_SHORT } from '../utils/booking';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';
import StarRating from './StarRating';
import NearbyStationsSearch from './NearbyStationsSearch';
import { usePageTitle } from '../utils/pageTitle';
import { assetUrl } from '../utils/apiUrl';

// Linkul stației pe Google Maps, altfel o căutare după nume + adresă
const mapLink = (s: PublicStationSummary) =>
  s.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address ?? ''}`.trim())}`;

const LINKS = [
  { href: '/', label: 'Pentru stații ITP' },
  { href: '/statii', label: 'Stații ITP' },
];

// "Lun–Vin" pentru zile consecutive, altfel lista ("Lun, Mie, Vin")
function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.length > 2 && consecutive) return `${WEEKDAYS_SHORT[sorted[0] - 1]}–${WEEKDAYS_SHORT[sorted[sorted.length - 1] - 1]}`;
  return sorted.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ');
}

// Fara diacritice si majuscule, ca "brasov" sa gaseasca "Brașov"
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Pagina publica pentru soferi: statiile ITP din Easy ITP la care se pot programa online
export default function StationsPage() {
  usePageTitle('Stații ITP cu programare online');
  const [stations, setStations] = useState<PublicStationSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPublicStations()
      .then(setStations)
      .catch(() => setError(true));
  }, []);

  const shown = useMemo(() => {
    if (!stations) return [];
    const q = fold(query.trim());
    if (!q) return stations;
    return stations.filter((s) => fold(`${s.name} ${s.address ?? ''}`).includes(q));
  }, [stations, query]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800">
      <PublicHeader links={LINKS} />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-blue-50 to-transparent dark:from-[#10213f]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Programează-te online la ITP</h1>
            <p className="mt-3 text-slate-600">
              Alege stația, tipul mașinii și ora care îți convine. Vezi doar orele libere, fără telefoane.
            </p>
            <div className="relative mt-6 max-w-xl mx-auto">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Caută după oraș sau numele stației..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          {error ? (
            <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} /> Lista stațiilor nu a putut fi încărcată. Încercați din nou peste câteva momente.
            </p>
          ) : !stations ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400 text-center">
              <Building2 size={36} className="opacity-30" />
              <p className="text-sm">
                {stations.length === 0 ? 'Încă nu sunt stații cu programare online.' : 'Nicio stație nu se potrivește căutării.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">
                {shown.length} {shown.length === 1 ? 'stație' : 'stații'}
              </p>
              <ul className="space-y-3">
                {shown.map((s) => (
                  <li key={s.slug} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3">
                        {s.logoUrl && (
                          <img
                            src={assetUrl(s.logoUrl)}
                            alt=""
                            loading="lazy"
                            className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-0.5"
                          />
                        )}
                        <p className="text-lg font-bold text-slate-900">{s.name}</p>
                      </div>
                      {s.googleRating != null && <StarRating rating={s.googleRating} count={s.googleRatingCount} href={s.mapsUrl} />}
                      {s.address && (
                        <a
                          href={mapLink(s)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-1.5 text-sm text-slate-600 hover:text-blue-600"
                        >
                          <MapPin size={15} className="mt-0.5 shrink-0" /> {s.address}
                        </a>
                      )}
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Clock size={15} /> {daysLabel(s.days)} · {s.open.slice(0, 5)}–{s.close.slice(0, 5)}
                        </span>
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-blue-600">
                            <Phone size={15} /> {s.phone}
                          </a>
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 shrink-0 sm:w-44">
                      <Link
                        to={`/programare/${s.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold whitespace-nowrap hover:bg-blue-700"
                      >
                        <CalendarCheck size={16} className="shrink-0" /> Programează-te
                      </Link>
                      <a
                        href={mapLink(s)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold whitespace-nowrap hover:bg-slate-50"
                      >
                        <Navigation size={16} /> Vezi pe hartă
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <NearbyStationsSearch />
          <p className="mt-10 text-center text-sm text-slate-500">
            Ai o stație ITP și vrei să apari aici?{' '}
            <Link to="/#demo" className="font-semibold text-blue-600 hover:underline">Cere o demonstrație</Link>
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
