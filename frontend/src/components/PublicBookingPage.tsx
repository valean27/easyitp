import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Car, MapPin, Phone, Clock, Loader2, CheckCircle2, AlertTriangle, CalendarDays, ArrowLeft } from 'lucide-react';
import type { PublicStation } from '../types';
import { createPublicBooking, getPublicSlots, getPublicStation } from '../api/publicApi';
import { toLocalIso } from '../utils/dates';
import { MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT, isoWeekday } from '../utils/booking';

const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-base text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS_LONG[isoWeekday(d) - 1]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function errorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

function StationHeader({ station }: { station: PublicStation }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-2">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2.5 rounded-xl">
          <Car size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">{station.name}</h1>
          <p className="text-sm text-slate-500">Programare ITP online</p>
        </div>
      </div>
      <div className="text-sm text-slate-600 space-y-1 pt-1">
        {station.address && (
          <p className="flex items-start gap-2">
            <MapPin size={15} className="shrink-0 mt-0.5 text-slate-400" />
            {station.address}
          </p>
        )}
        {station.phone && (
          <a href={`tel:${station.phone}`} className="flex items-center gap-2 text-blue-600">
            <Phone size={15} className="shrink-0" />
            {station.phone}
          </a>
        )}
        <p className="flex items-center gap-2">
          <Clock size={15} className="shrink-0 text-slate-400" />
          {station.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')} · {station.open.slice(0, 5)} – {station.close.slice(0, 5)}
        </p>
      </div>
    </div>
  );
}

export default function PublicBookingPage() {
  const { slug = '' } = useParams();
  const [station, setStation] = useState<PublicStation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    getPublicStation(slug)
      .then((s) => {
        setStation(s);
        document.title = `Programare ITP · ${s.name}`;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  // Zilele lucratoare din urmatoarea perioada (azi inclus)
  const dates = useMemo(() => {
    if (!station) return [];
    const result: string[] = [];
    const d = new Date();
    for (let i = 0; i <= station.maxDaysAhead; i++) {
      if (station.days.includes(isoWeekday(d))) result.push(toLocalIso(d).slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [station]);

  const loadSlots = (day: string) => {
    setSlotsLoading(true);
    setSlots(null);
    getPublicSlots(slug, day)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  };

  const selectDate = (day: string) => {
    setDate(day);
    setTime(null);
    setError(null);
    loadSlots(day);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    setError(null);
    setSubmitting(true);
    try {
      await createPublicBooking(slug, {
        clientName: name,
        phone,
        licensePlate: plate,
        appointmentDate: `${date}T${time}`,
        website,
      });
      setConfirmed({ date, time });
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setError('Ora aleasă tocmai a fost ocupată. Alegeți altă oră.');
        setTime(null);
        loadSlots(date);
      } else if (status === 429) {
        setError('Prea multe programări de pe acest dispozitiv. Încercați mai târziu sau sunați la stație.');
      } else if (status === 400) {
        setError('Verificați numele și numărul de telefon.');
      } else {
        setError('Programarea nu a putut fi trimisă. Încercați din nou.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-sm text-center space-y-2">
          <AlertTriangle size={32} className="mx-auto text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-800">Pagină indisponibilă</h1>
          <p className="text-sm text-slate-500">Stația nu există sau nu acceptă momentan programări online.</p>
        </div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center space-y-3">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-800">Programare confirmată</h1>
            <p className="text-slate-700">
              Vă așteptăm <span className="font-semibold">{longDate(confirmed.date)}</span> la ora{' '}
              <span className="font-semibold">{confirmed.time.slice(0, 5)}</span>.
            </p>
            <p className="text-sm text-slate-500">
              Aveți la dumneavoastră talonul și cartea de identitate a vehiculului.
              {station.phone && ` Dacă nu mai puteți ajunge, sunați la ${station.phone}.`}
            </p>
          </div>
          <StationHeader station={station} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <StationHeader station={station} />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <CalendarDays size={17} className="text-blue-600" />
            1. Alegeți ziua
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {dates.map((d) => {
              const dt = new Date(`${d}T12:00:00`);
              const active = d === date;
              return (
                <button
                  key={d}
                  onClick={() => selectDate(d)}
                  className={`shrink-0 w-16 py-2 rounded-xl border text-center transition-colors ${
                    active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                  }`}
                >
                  <div className={`text-xs ${active ? 'text-blue-100' : 'text-slate-400'}`}>{WEEKDAYS_SHORT[isoWeekday(dt) - 1]}</div>
                  <div className="text-lg font-semibold leading-tight">{dt.getDate()}</div>
                  <div className={`text-xs ${active ? 'text-blue-100' : 'text-slate-400'}`}>{MONTHS_SHORT[dt.getMonth()]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {date && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <Clock size={17} className="text-blue-600" />
              2. Alegeți ora · <span className="font-normal text-slate-500">{longDate(date)}</span>
            </h2>
            {slotsLoading ? (
              <div className="flex items-center text-sm text-slate-400 py-2">
                <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă orele libere...
              </div>
            ) : slots && slots.length === 0 ? (
              <p className="text-sm text-slate-500 py-1">Nu mai sunt ore libere în această zi. Alegeți altă zi.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {slots?.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setTime(s);
                      setError(null);
                    }}
                    className={`py-2 rounded-xl border text-sm font-medium transition-colors ${
                      s === time ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    {s.slice(0, 5)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {date && time && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">3. Datele dumneavoastră</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nume și prenume</label>
              <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xx xxx xxx"
                autoComplete="tel"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nr. înmatriculare <span className="text-slate-400 font-normal">(opțional)</span>
              </label>
              <input
                value={plate}
                maxLength={15}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="CJ 01 ABC"
                className={INPUT_CLS + ' uppercase'}
              />
            </div>
            {/* Camp-capcana pentru boti: ascuns pentru oameni */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 size={17} className="animate-spin" />}
              Confirmă programarea · {longDate(date)}, {time.slice(0, 5)}
            </button>
            <button
              type="button"
              onClick={() => setTime(null)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={14} /> Altă oră
            </button>
          </form>
        )}

        {error && !time && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-2">Datele sunt folosite doar pentru programarea la ITP.</p>
      </div>
    </div>
  );
}
