import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Car,
  MapPin,
  Phone,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ArrowLeft,
  Truck,
  Navigation,
  Star,
  ExternalLink,
} from 'lucide-react';
import type { PublicStation, VehicleCategory } from '../types';
import { createPublicBooking, getPublicSlots, getPublicStation } from '../api/publicApi';
import { toLocalIso } from '../utils/dates';
import StarRating from './StarRating';
import { MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT, isoWeekday } from '../utils/booking';
import { breakText, closedMap, closedNotice } from '../utils/closedDays';
import { usePageTitle } from '../utils/pageTitle';
import { checkMobile } from '../utils/phone';
import AddToCalendar from './AddToCalendar';
import { assetUrl } from '../utils/apiUrl';
import { apiMessage } from '../utils/errors';

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
        {station.logoUrl ? (
          <img
            src={assetUrl(station.logoUrl)}
            alt={`Logo ${station.name}`}
            className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-white object-contain p-1"
          />
        ) : (
          <div className="bg-blue-600 p-2.5 rounded-xl">
            <Car size={20} className="text-white" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">{station.name}</h1>
          <p className="text-sm text-slate-500">Programare ITP online</p>
        </div>
      </div>
      {station.bookingMessage && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 whitespace-pre-line">{station.bookingMessage}</p>
      )}
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
          {breakText(station.breakStart, station.breakEnd) && ` · pauză ${breakText(station.breakStart, station.breakEnd)}`}
        </p>
        {station.googleRating != null && (
          <StarRating rating={station.googleRating} count={station.googleRatingCount} href={station.mapsUrl} />
        )}
        {(station.mapsUrl || station.facebookUrl || station.reviewUrl) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {station.mapsUrl && (
              <a href={station.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Navigation size={14} /> Vezi pe hartă
              </a>
            )}
            {station.reviewUrl && (
              <a href={station.reviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Star size={14} /> Recenzii
              </a>
            )}
            {station.facebookUrl && (
              <a href={station.facebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <ExternalLink size={14} /> Facebook
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PublicBookingPage() {
  const { slug = '' } = useParams();
  const [station, setStation] = useState<PublicStation | null>(null);
  usePageTitle(station ? `Programare ITP – ${station.name}` : 'Programare ITP online');
  const [notFound, setNotFound] = useState(false);
  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // greseala la telefon apare dupa ce clientul paraseste campul (sau la trimitere), nu cat scrie
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneCheck = useMemo(() => checkMobile(phone), [phone]);
  const [plate, setPlate] = useState('');
  const [website, setWebsite] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    time: string;
    vehicle: string;
    token: string | null;
    googleUrl: string | null;
    icsUrl: string | null;
    email: string | null;
  } | null>(null);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  // optional; daca e scris trebuie sa arate a email
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  useEffect(() => {
    getPublicStation(slug)
      .then((s) => {
        setStation(s);
        // Cu un singur tip de vehicul nu mai cerem alegerea
        if (s.vehicleTypes.length === 1) setCategory(s.vehicleTypes[0].category);
        document.title = `Programare ITP · ${s.name}`;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  // Zilele lucratoare din urmatoarea perioada (azi inclus)
  const dates = useMemo(() => {
    if (!station) return [];
    const result: string[] = [];
    const closed = closedMap(station.closedDays);
    const d = new Date();
    for (let i = 0; i <= station.maxDaysAhead; i++) {
      const iso = toLocalIso(d).slice(0, 10);
      if (station.days.includes(isoWeekday(d)) && !closed.has(iso)) result.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [station]);

  const loadSlots = (day: string, vehicle: VehicleCategory) => {
    setSlotsLoading(true);
    setSlots(null);
    getPublicSlots(slug, day, vehicle)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  };

  const selectDate = (day: string) => {
    if (!category) return;
    setDate(day);
    setTime(null);
    setError(null);
    loadSlots(day, category);
  };

  // Alt tip de vehicul = alta durata, deci alte ore libere
  const selectCategory = (vehicle: VehicleCategory) => {
    setCategory(vehicle);
    setTime(null);
    setError(null);
    if (date) loadSlots(date, vehicle);
  };

  const vehicle = station?.vehicleTypes.find((t) => t.category === category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !category) return;
    setError(null);
    if (!phoneCheck.ok) {
      setPhoneTouched(true);
      document.getElementById('booking-phone')?.focus();
      return;
    }
    if (!emailOk) {
      setEmailTouched(true);
      document.getElementById('booking-email')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPublicBooking(slug, {
        clientName: name,
        phone: phoneCheck.formatted ?? phone,
        email: email.trim() || undefined,
        licensePlate: plate,
        appointmentDate: `${date}T${time}`,
        vehicleCategory: category,
        reminderConsent: consent,
        website,
      });
      setConfirmed({
        date,
        time,
        vehicle: vehicle?.label ?? '',
        token: result.manageToken,
        googleUrl: result.googleCalendarUrl,
        icsUrl: result.icsUrl,
        email: email.trim() || null,
      });
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setError('Ora aleasă tocmai a fost ocupată. Alegeți altă oră.');
        setTime(null);
        loadSlots(date, category);
      } else if (status === 429) {
        setError('Prea multe programări de pe acest dispozitiv. Încercați mai târziu sau sunați la stație.');
      } else if (status === 400) {
        setError(apiMessage(err, 'Verificați numele și numărul de telefon.'));
      } else {
        setError('Programarea nu a putut fi trimisă. Încercați din nou.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const step = (n: number) => (station && station.vehicleTypes.length > 1 ? n : n - 1);

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
            {confirmed.vehicle && <p className="text-sm text-slate-500">{confirmed.vehicle}</p>}
            <p className="text-sm text-slate-500">
              Aveți la dumneavoastră talonul și cartea de identitate a vehiculului.
              {station.phone && ` Dacă nu mai puteți ajunge, sunați la ${station.phone}.`}
            </p>
            {confirmed.email && (
              <p className="text-sm text-slate-500">
                V-am trimis confirmarea pe <span className="font-medium text-slate-700">{confirmed.email}</span>.
              </p>
            )}
            <div className="pt-1">
              <p className="mb-2 text-sm font-medium text-slate-600">Puneți programarea în calendar:</p>
              <AddToCalendar googleUrl={confirmed.googleUrl} icsUrl={confirmed.icsUrl} />
            </div>
            {confirmed.token && (
              <Link to={`/p/${confirmed.token}`} className="inline-block text-sm font-semibold text-blue-600 hover:underline">
                Anulați sau alegeți altă oră
              </Link>
            )}
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

        {station.vehicleTypes.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <Truck size={17} className="text-blue-600" />
              {step(1)}. Ce vehicul aduceți?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {station.vehicleTypes.map((t) => {
                const active = t.category === category;
                return (
                  <button
                    key={t.category}
                    onClick={() => selectCategory(t.category)}
                    className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border text-left transition-colors ${
                      active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <span className="font-medium">{t.label}</span>
                    <span className={`text-xs shrink-0 text-right ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                      ~{t.minutes} min
                      {t.price != null && <span className={`block text-sm font-semibold ${active ? 'text-white' : 'text-slate-700'}`}>{t.price} lei</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {category && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <CalendarDays size={17} className="text-blue-600" />
              {step(2)}. Alegeți ziua
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
            {closedNotice(station.closedDays) && <p className="text-xs text-slate-500">{closedNotice(station.closedDays)}</p>}
            {station.vehicleTypes.length === 1 && station.vehicleTypes[0].price != null && (
              <p className="text-sm text-slate-600">
                Tarif ITP: <span className="font-semibold text-slate-800">{station.vehicleTypes[0].price} lei</span>
              </p>
            )}
          </div>
        )}

        {category && date && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <Clock size={17} className="text-blue-600" />
              {step(3)}. Alegeți ora · <span className="font-normal text-slate-500">{longDate(date)}</span>
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

        {category && date && time && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">{step(4)}. Datele dumneavoastră</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nume și prenume</label>
              <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input
                id="booking-phone"
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                placeholder="07xx xxx xxx"
                autoComplete="tel"
                aria-invalid={phoneTouched && !phoneCheck.ok}
                aria-describedby="booking-phone-hint"
                className={INPUT_CLS + (phoneTouched && !phoneCheck.ok ? ' border-red-400 ring-1 ring-red-300' : '')}
              />
              <p id="booking-phone-hint" className={`text-xs mt-1 ${phoneTouched && !phoneCheck.ok ? 'text-red-600' : 'text-slate-400'}`}>
                {phoneTouched && !phoneCheck.ok
                  ? phoneCheck.error
                  : phoneCheck.ok
                    ? `✓ ${phoneCheck.formatted}${phoneCheck.country ? ` · ${phoneCheck.country}` : ''}`
                    : 'Număr de mobil; din altă țară, cu prefixul țării (ex. +49 ...).'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Email <span className="text-slate-400 font-normal">(opțional)</span>
              </label>
              <input
                id="booking-email"
                type="email"
                inputMode="email"
                value={email}
                maxLength={150}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="nume@exemplu.ro"
                autoComplete="email"
                aria-invalid={emailTouched && !emailOk}
                aria-describedby="booking-email-hint"
                className={INPUT_CLS + (emailTouched && !emailOk ? ' border-red-400 ring-1 ring-red-300' : '')}
              />
              <p id="booking-email-hint" className={`text-xs mt-1 ${emailTouched && !emailOk ? 'text-red-600' : 'text-slate-400'}`}>
                {emailTouched && !emailOk
                  ? 'Adresa de email nu este validă (ex. nume@exemplu.ro).'
                  : 'Primiți confirmarea pe email, cu buton de adăugat în calendar.'}
              </p>
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
            <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Vreau să primesc de la {station?.name || 'stație'} un mesaj când se apropie următorul ITP sau alte scadențe ale mașinii (RCA, rovinietă), plus o cerere de recenzie după ITP.{' '}
                <span className="text-slate-400">Opțional; vă puteți dezabona oricând din link-ul din mesaj.</span>
              </span>
            </label>
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
              {vehicle && station.vehicleTypes.length > 1 ? ` · ${vehicle.label}` : ''}
              {vehicle?.price != null ? ` · ${vehicle.price} lei` : ''}
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

        <p className="text-center text-xs text-slate-400 pt-2">
          Datele sunt folosite doar pentru programarea la ITP și, dacă bifați, pentru mesajele stației (reminderul următorului ITP, cererea de recenzie).{' '}
          <Link to="/confidentialitate" className="underline hover:text-slate-600">Confidențialitate</Link>
        </p>
      </div>
    </div>
  );
}
