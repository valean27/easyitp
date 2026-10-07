import { useState, type FormEvent } from 'react';
import { LocateFixed, ExternalLink } from 'lucide-react';
import { nearbyMapsUrl } from '../utils/nearbyMap';

// "Caută stație ITP în zona ta": deschide căutarea în Google Maps (pe telefon, aplicația Maps).
// Căutarea o face șoferul direct la Google, gratuit; harta Embed nu arată liste de rezultate.
export default function NearbyStationsSearch() {
  const [city, setCity] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    if (q.length >= 2) window.open(nearbyMapsUrl(q), '_blank', 'noopener');
  };

  return (
    <section id="zona-ta" className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <LocateFixed size={20} className="text-blue-600" /> Caută stație ITP în zona ta
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Nu ai găsit stația mai sus? Scrie orașul și îți deschidem Google Maps cu toate stațiile ITP din zonă.
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
          disabled={city.trim().length < 2}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          Caută pe Google Maps <ExternalLink size={15} />
        </button>
      </form>
    </section>
  );
}
