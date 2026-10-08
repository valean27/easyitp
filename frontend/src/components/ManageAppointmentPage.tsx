import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, CalendarX, Clock, Loader2, MapPin, Phone, AlertTriangle, CheckCircle2, Car } from 'lucide-react';
import {
  cancelMyAppointment,
  getMyAppointment,
  getMyAppointmentSlots,
  getPublicStation,
  rescheduleMyAppointment,
  type ManagedAppointment,
} from '../api/publicApi';
import type { PublicStation } from '../types';
import { apiMessage } from '../utils/errors';
import { isoWeekday, WEEKDAYS_SHORT, MONTHS_SHORT } from '../utils/booking';
import { toLocalIso } from '../utils/dates';
import AddToCalendar from './AddToCalendar';

const LONG_DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];

function longWhen(iso: string): string {
  const d = new Date(iso);
  return `${LONG_DAYS[isoWeekday(d) - 1]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ora ${iso.slice(11, 16)}`;
}

// Pagina din link-ul SMS-ului (fara login): clientul isi vede programarea, o anuleaza sau o muta pe alta ora libera
export default function ManageAppointmentPage() {
  const { token = '' } = useParams();
  const [appt, setAppt] = useState<ManagedAppointment | null>(null);
  const [station, setStation] = useState<PublicStation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);

  useEffect(() => {
    getMyAppointment(token)
      .then((a) => {
        setAppt(a);
        if (a.slug) getPublicStation(a.slug).then(setStation).catch(() => {});
      })
      .catch(() => setNotFound(true));
  }, [token]);

  // Zilele in care statia lucreaza (urmatoarele 30), sau 14 zile la rand daca nu stim programul
  const days = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const limit = station?.maxDaysAhead ?? 14;
    for (let i = 0; i <= limit && out.length < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (!station || station.days.includes(isoWeekday(d))) out.push(d);
    }
    return out;
  }, [station]);

  const pickDate = (d: Date) => {
    const iso = toLocalIso(d).slice(0, 10);
    setDate(iso);
    setSlots(null);
    getMyAppointmentSlots(token, iso)
      .then(setSlots)
      .catch(() => setSlots([]));
  };

  const cancel = async () => {
    if (!confirm('Sigur anulați programarea?')) return;
    setBusy(true);
    setError(null);
    try {
      setAppt(await cancelMyAppointment(token));
      setNotice('Programarea a fost anulată. Vă mulțumim că ne-ați anunțat!');
    } catch (err) {
      setError(apiMessage(err, 'Programarea nu a putut fi anulată.'));
    } finally {
      setBusy(false);
    }
  };

  const move = async (time: string) => {
    if (!date) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await rescheduleMyAppointment(token, `${date}T${time.slice(0, 5)}`);
      setAppt(saved);
      setMoving(false);
      setDate(null);
      setNotice(`Gata, v-am mutat ${longWhen(saved.appointmentDate)}.`);
    } catch (err) {
      setError(apiMessage(err, 'Programarea nu a putut fi mutată.'));
      if (date) pickDate(new Date(`${date}T00:00:00`));
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-100 p-6 text-center space-y-3">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <h1 className="text-lg font-bold text-slate-800">Programarea nu a fost găsită</h1>
          <p className="text-sm text-slate-500">Link-ul nu mai este valabil. Pentru schimbări sunați la stație.</p>
        </div>
      </div>
    );
  }
  if (!appt) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const cancelled = appt.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Programarea dumneavoastră</p>
          <h1 className="text-xl font-bold text-slate-800">{appt.stationName}</h1>
          <p className={`flex items-center gap-2 text-lg font-semibold ${cancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            <CalendarCheck size={20} className="text-blue-600 shrink-0" /> {longWhen(appt.appointmentDate)}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Car size={16} className="shrink-0" /> {appt.vehicleLabel}
            {appt.licensePlate && <span className="font-mono font-semibold">· {appt.licensePlate.toUpperCase()}</span>}
          </p>
          {appt.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${appt.stationName} ${appt.address}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-sm text-slate-600 hover:text-blue-600"
            >
              <MapPin size={16} className="shrink-0 mt-0.5" /> {appt.address}
            </a>
          )}
          {appt.phone && (
            <a href={`tel:${appt.phone}`} className="flex items-center gap-2 text-sm text-blue-600">
              <Phone size={16} className="shrink-0" /> {appt.phone}
            </a>
          )}
          {cancelled && <p className="text-sm font-medium text-red-600">Programarea este anulată.</p>}
          {appt.status === 'COMPLETED' && <p className="text-sm font-medium text-emerald-600">ITP-ul a fost efectuat. Drum bun!</p>}
          {appt.status === 'SCHEDULED' && (
            <div className="pt-1">
              <AddToCalendar googleUrl={appt.googleCalendarUrl} icsUrl={appt.icsUrl} />
            </div>
          )}
        </div>

        {notice && (
          <p className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle2 size={17} className="shrink-0 mt-0.5" /> {notice}
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" /> {error}
          </p>
        )}

        {appt.canChange && !moving && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setMoving(true)}
              disabled={busy}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              <Clock size={18} /> Alege altă oră
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <CalendarX size={18} />} Anulează
            </button>
          </div>
        )}

        {appt.canChange && moving && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Alegeți ziua și ora</h2>
              <button onClick={() => { setMoving(false); setDate(null); }} className="text-sm text-slate-500 hover:text-slate-700">
                Renunță
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const iso = toLocalIso(d).slice(0, 10);
                const active = iso === date;
                return (
                  <button
                    key={iso}
                    onClick={() => pickDate(d)}
                    className={`shrink-0 w-16 py-2 rounded-xl border text-center ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="block text-xs">{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
                    <span className="block text-lg font-semibold">{d.getDate()}</span>
                    <span className="block text-xs">{MONTHS_SHORT[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>
            {date && !slots && <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />}
            {date && slots && slots.length === 0 && <p className="text-sm text-slate-500">Nicio oră liberă în această zi. Alegeți alta.</p>}
            {slots && slots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((t) => (
                  <button
                    key={t}
                    onClick={() => move(t)}
                    disabled={busy}
                    className="py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-60"
                  >
                    {t.slice(0, 5)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!appt.canChange && appt.status === 'SCHEDULED' && (
          <p className="text-sm text-slate-500 text-center">
            Cu mai puțin de o oră înainte, programarea se poate schimba doar telefonic.
          </p>
        )}
      </div>
    </div>
  );
}
