import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Phone, Globe, CheckCircle2, UserX, RotateCcw, Loader2, AlertTriangle, ClipboardCheck, XCircle, CalendarDays, WifiOff } from 'lucide-react';
import InspectorItpModal from './InspectorItpModal';
import AppDeviceSettings from './AppDeviceSettings';
import { useAuth } from '../context/auth';
import { isNetworkError, loadToday, saveToday, savedTime } from '../utils/offline';
import type { Appointment, AppointmentStatus, InspectorMe, InspectorPortalDay } from '../types';
import { getInspectorDay, getInspectorMe, setMyAppointmentStatus } from '../api/inspectorPortalApi';
import { useTheme } from '../context/theme';
import { todayIso } from '../utils/dates';
import { APPOINTMENT_STATUS_LABELS, VEHICLE_SHORT_LABELS, appointmentMinutes } from '../utils/appointments';
import { LEAVE_LABELS, WEEKDAYS, colorHex, hm, initials, rangeLabel } from '../utils/inspectors';
import { lineName } from '../utils/lines';
import { apiMessage } from '../utils/errors';

// Pagina de start a inspectorului (rol INSPECTOR): ziua lui, programarile lui si programul saptamanii

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
}

function dayLabel(iso: string): string {
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const STATUS_CLS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
  NO_SHOW: 'bg-orange-100 text-orange-800',
};

export default function InspectorHomePage() {
  const { resolved } = useTheme();
  const [me, setMe] = useState<InspectorMe | null>(null);
  const [date, setDate] = useState(todayIso);
  const [day, setDay] = useState<InspectorPortalDay | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [itpFor, setItpFor] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const account = useAuth().user?.email ?? null;
  const [offlineAt, setOfflineAt] = useState<string | null>(null);

  useEffect(() => {
    getInspectorMe()
      .then((m) => {
        setMe(m);
        if (account) saveToday('inspector-me', account, todayIso(), m);
      })
      .catch((err) => {
        const saved = account && isNetworkError(err) ? loadToday<InspectorMe>('inspector-me', account, todayIso()) : null;
        if (saved) setMe(saved.data);
        else setError(apiMessage(err, 'Datele nu au putut fi încărcate.'));
      });
  }, [account]);

  // Ziua de azi se pastreaza si pe dispozitiv: fara internet se vede ultima copie (doar citire)
  const load = useCallback(() => {
    getInspectorDay(date)
      .then((d) => {
        setDay(d);
        setOfflineAt(null);
        if (account && date === todayIso()) saveToday('inspector-day', account, date, d);
      })
      .catch((err) => {
        const saved =
          account && date === todayIso() && isNetworkError(err) ? loadToday<InspectorPortalDay>('inspector-day', account, date) : null;
        if (saved) {
          setDay(saved.data);
          setOfflineAt(saved.savedAt);
        } else {
          setError(apiMessage(err, 'Programările nu au putut fi încărcate.'));
        }
      });
  }, [date, account]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (a: Appointment, status: AppointmentStatus) => {
    setBusy(a.id);
    try {
      const saved = await setMyAppointmentStatus(a.id, status);
      setDay((d) => (d ? { ...d, appointments: d.appointments.map((x) => (x.id === a.id ? { ...x, status: saved.status } : x)) } : d));
    } catch (err) {
      setError(apiMessage(err, 'Statusul nu a putut fi schimbat.'));
    } finally {
      setBusy(null);
    }
  };

  const isToday = date === todayIso();
  const shown = day?.date === date ? day : null;
  const left = shown?.appointments.filter((a) => a.status === 'SCHEDULED').length ?? 0;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center gap-3">
          {me && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: colorHex(me.color, resolved) }}
              aria-hidden
            >
              {initials(me.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight truncate">{me ? `Bună, ${me.name.split(' ')[0]}` : 'Ziua mea'}</h1>
            <p className="text-xs text-slate-400 leading-tight truncate">{me?.stationName ?? ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}
        {offlineAt && (
          <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <WifiOff size={15} className="shrink-0" /> Fără internet: programările de azi salvate la {savedTime(offlineAt)}.
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(shiftDay(date, -1))} className="p-2 rounded-lg text-slate-500 hover:bg-white" aria-label="Ziua de dinainte">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setDate(todayIso())}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${isToday ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            Azi
          </button>
          <button type="button" onClick={() => setDate(shiftDay(date, 1))} className="p-2 rounded-lg text-slate-500 hover:bg-white" aria-label="Ziua următoare">
            <ChevronRight size={18} />
          </button>
          <p className="ml-1 text-sm font-semibold text-slate-800">{dayLabel(date)}</p>
        </div>

        {/* Unde lucreaza in ziua aleasa */}
        {shown && (
          <div className={`rounded-xl border px-4 py-3 ${shown.works ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}>
            {shown.works ? (
              <p className="text-sm">
                {isToday ? 'Azi lucrezi' : 'Lucrezi'}
                {shown.line && me ? (
                  <>
                    {' '}
                    pe <b>{lineName(me.lineNames, shown.line)}</b>
                  </>
                ) : null}
                {shown.start && shown.end ? (
                  <>
                    , <b>{hm(shown.start)}–{hm(shown.end)}</b>
                  </>
                ) : null}
                . {shown.appointments.length === 0 ? 'Nicio programare.' : `${shown.appointments.length} programări${left ? `, ${left} de făcut` : ''}.`}
              </p>
            ) : shown.leave ? (
              <p className="text-sm">
                {isToday ? 'Azi ești' : 'Ești'} în <b>{LEAVE_LABELS[shown.leave].toLowerCase()}</b>.
              </p>
            ) : (
              <p className="text-sm">{isToday ? 'Azi ești liber.' : 'Zi liberă.'}</p>
            )}
          </div>
        )}

        {/* Programarile */}
        {!shown ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Se încarcă...
          </div>
        ) : shown.appointments.length > 0 ? (
          <ul className="space-y-2">
            {shown.appointments.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0">
                    <p className="text-lg font-bold tabular-nums text-slate-800">{a.appointmentDate.slice(11, 16)}</p>
                    <p className="text-[11px] text-slate-500">{appointmentMinutes(a)} min</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span className="truncate">{a.clientName}</span>
                      {a.source === 'ONLINE' && <Globe size={13} className="shrink-0 text-purple-600" aria-label="Programare online" />}
                    </p>
                    <p className="text-sm text-slate-600">
                      {[a.licensePlate, a.vehicleCategory ? VEHICLE_SHORT_LABELS[a.vehicleCategory] : null, a.line && me && a.line !== shown.line ? lineName(me.lineNames, a.line) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {a.phone && (
                      <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-blue-600">
                        <Phone size={13} /> {a.phone}
                      </a>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[a.status]}`}>{APPOINTMENT_STATUS_LABELS[a.status]}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.itpRecordId ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                      <CheckCircle2 size={15} /> ITP înregistrat
                    </p>
                  ) : a.status === 'SCHEDULED' || a.status === 'COMPLETED' ? (
                    <>
                      {/* "Finalizat" vine din ITP-ul salvat, nu se pune de mana */}
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => setItpFor(a)}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        <ClipboardCheck size={15} /> Începe ITP
                      </button>
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => changeStatus(a, 'NO_SHOW')}
                        className="flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                      >
                        <UserX size={15} /> Nu a venit
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => changeStatus(a, 'SCHEDULED')}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <RotateCcw size={14} /> Înapoi la programat
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          shown.works && <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Nicio programare pentru tine.</p>
        )}

        {me && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ClipboardCheck size={14} /> ITP-uri luna asta
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{me.itpsThisMonth}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <XCircle size={14} /> Respinse
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">
                  {me.failedThisMonth}
                  {me.itpsThisMonth > 0 && (
                    <span className="ml-1 text-sm font-normal text-slate-500">({Math.round((me.failedThisMonth * 100) / me.itpsThisMonth)}%)</span>
                  )}
                </p>
              </div>
            </div>

            <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
              <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                <CalendarDays size={15} /> Programul meu
              </h2>
              {me.schedule.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-600">
                  Fără program fix{me.defaultLine ? `, de obicei pe ${lineName(me.lineNames, me.defaultLine)}` : ''}.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {WEEKDAYS.map((label, i) => {
                    const d = me.schedule.find((x) => x.weekday === i + 1);
                    const line = d?.line ?? me.defaultLine;
                    return (
                      <li key={label} className={`flex items-center justify-between px-4 py-2 text-sm ${d ? 'text-slate-800' : 'text-slate-400'}`}>
                        <span className="font-medium">{label}</span>
                        <span>
                          {d ? [d.start && d.end ? `${hm(d.start)}–${hm(d.end)}` : null, line ? lineName(me.lineNames, line) : null].filter(Boolean).join(' · ') || 'Lucrez' : 'Liber'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {me.leaves.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-2">
                  <p className="text-xs font-semibold text-slate-600">Absențe care urmează</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                    {me.leaves.map((l) => (
                      <li key={l.from}>
                        {LEAVE_LABELS[l.kind]} {rangeLabel(l)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Programul și concediile le stabilește stația; o zi anume poate fi schimbată de manager.
              </p>
            </section>
          </>
        )}

        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700">
            Aplicația pe telefon și notificări
          </summary>
          <div className="border-t border-slate-100 px-4 py-4">
            <AppDeviceSettings who="inspector" />
          </div>
        </details>
      </main>

      {itpFor && (
        <InspectorItpModal
          appointment={itpFor}
          onClose={() => setItpFor(null)}
          onSaved={(saved) => {
            setDay((d) => (d ? { ...d, appointments: d.appointments.map((x) => (x.id === saved.id ? saved : x)) } : d));
            getInspectorMe().then(setMe).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
