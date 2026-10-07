import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, CalendarCheck, Loader2, AlertTriangle, Navigation, LocateFixed } from 'lucide-react';
import { getNearbyAvailable, searchNearbyStations, type NearbyStation } from '../api/publicApi';
import { apiMessage } from '../utils/errors';
import StarRating from './StarRating';

// "Caută stație ITP în zona ta": toate stațiile ITP dintr-un oraș, de pe Google (căutare live).
// Ascunsă când serverul nu are cheie Google. Stațiile din Easy ITP primesc butonul de programare.
export default function NearbyStationsSearch() {
  const [available, setAvailable] = useState(false);
  const [city, setCity] = useState('');
  const [results, setResults] = useState<NearbyStation[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getNearbyAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    if (q.length < 2 || loading) return;
    setLoading(true);
    setError('');
    try {
      setResults(await searchNearbyStations(q));
      setSearched(q);
    } catch (err) {
      setError(apiMessage(err, 'Căutarea nu a reușit. Încercați din nou.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="zona-ta" className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <LocateFixed size={20} className="text-blue-600" /> Caută stație ITP în zona ta
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Nu ai găsit stația mai sus? Scrie orașul și îți arătăm toate stațiile ITP din zonă, de pe Google.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <label htmlFor="nearby-city" className="sr-only">Orașul</label>
        <input
          id="nearby-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Orașul (ex. Cluj-Napoca)"
          maxLength={60}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || city.trim().length < 2}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />} Caută
        </button>
      </form>

      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </p>
      )}

      {results && !error && (
        results.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nu am găsit stații ITP în „{searched}”.</p>
        ) : (
          <>
            <p className="mt-4 mb-3 text-sm text-slate-500">
              {results.length} {results.length === 1 ? 'stație' : 'stații'} în „{searched}” · rezultate de pe Google
            </p>
            <ul className="space-y-3">
              {results.map((s, i) => (
                <li key={`${s.name}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="font-bold text-slate-900">{s.name}</p>
                    {s.rating != null && <StarRating rating={s.rating} count={s.ratingCount} href={s.mapsUrl} />}
                    {s.address && (
                      <p className="flex items-start gap-1.5 text-sm text-slate-600">
                        <MapPin size={15} className="mt-0.5 shrink-0" /> {s.address}
                      </p>
                    )}
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600">
                        <Phone size={15} /> {s.phone}
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 shrink-0 sm:w-44">
                    {s.slug && (
                      <Link
                        to={`/programare/${s.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold whitespace-nowrap hover:bg-blue-700"
                      >
                        <CalendarCheck size={16} className="shrink-0" /> Programează-te
                      </Link>
                    )}
                    {s.mapsUrl && (
                      <a
                        href={s.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold whitespace-nowrap hover:bg-slate-50"
                      >
                        <Navigation size={16} /> Vezi pe hartă
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
