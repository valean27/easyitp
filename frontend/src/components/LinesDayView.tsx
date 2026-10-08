import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, CheckCircle2 } from 'lucide-react';
import type { Appointment, AppointmentStatus, Inspector, LineShift } from '../types';
import { colorHex, initials } from '../utils/inspectors';
import { useTheme } from '../context/theme';
import DateField from './DateField';
import { todayIso } from '../utils/dates';
import { VEHICLE_SHORT_LABELS, appointmentMinutes } from '../utils/appointments';
import { dayColumns, hhmm, lanes, lineName, minuteOfDay, occupancy, snap } from '../utils/lines';

// Vederea "Pe linii": o zi, cate o coloana pentru fiecare linie ITP (ca niste calendare alaturate).
// Click pe un loc liber = programare noua pe linia si ora aceea; o programare se trage pe alta ora sau alta linie.

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 96;
const PX_PER_MIN = HOUR_PX / 60;
const DRAG_STEP = 5;
const CLICK_STEP = 15;

const STATUS_CLS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-100 border-blue-500 text-blue-900',
  COMPLETED: 'bg-green-100 border-green-500 text-green-900',
  CANCELLED: 'bg-slate-100 border-slate-400 text-slate-600',
  NO_SHOW: 'bg-orange-100 border-orange-500 text-orange-900',
};
const ONLINE_CLS = 'bg-purple-100 border-purple-500 text-purple-900';

interface Drag {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
  // unde ar ajunge: minutul zilei si linia de sub mouse
  start: number;
  line: number | null;
}

interface Props {
  date: string; // yyyy-mm-dd
  onDateChange: (date: string) => void;
  appointments: Appointment[];
  lineNames: string[];
  open?: string; // HH:mm:ss, programul statiei
  close?: string;
  team: Inspector[];
  shifts: LineShift[];
  onShiftChange: (line: number, inspectorId: number | null, reset: boolean) => void;
  onCreate: (dateTime: string, line: number | null) => void;
  onOpen: (appointment: Appointment) => void;
  onMove: (appointment: Appointment, dateTime: string, line: number | null) => void;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
}

function dayLabel(iso: string): string {
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const clampMinute = (m: number, minutes: number) => Math.min(Math.max(m, START_HOUR * 60), END_HOUR * 60 - minutes);

export default function LinesDayView({
  date,
  onDateChange,
  appointments,
  lineNames,
  open,
  close,
  team,
  shifts,
  onShiftChange,
  onCreate,
  onOpen,
  onMove,
}: Props) {
  const { resolved } = useTheme();
  const columnsRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // dupa o mutare, click-ul care urmeaza nu mai deschide fereastra programarii
  const justMoved = useRef(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // La deschidere, programul incepe sus (ora deschiderii sau ora curenta, azi)
  useEffect(() => {
    const first = Math.max(START_HOUR, (open ? Number(open.slice(0, 2)) : 8) - 0.5);
    if (scrollRef.current) scrollRef.current.scrollTop = (first - START_HOUR) * HOUR_PX;
  }, [date, open]);

  // Anulatele nu ocupa linia, deci nu apar aici (raman in calendar)
  const day = useMemo(
    () => appointments.filter((a) => a.appointmentDate.slice(0, 10) === date && a.status !== 'CANCELLED'),
    [appointments, date]
  );
  const columns = useMemo(() => dayColumns(day, Math.max(1, lineNames.length)), [day, lineNames.length]);
  const byColumn = useMemo(() => columns.map((line) => day.filter((a) => (a.line ?? null) === line)), [columns, day]);
  const layout = useMemo(() => byColumn.map((list) => lanes(list)), [byColumn]);

  const openMinute = open ? minuteOfDay(`0000-00-00T${open}`) : 8 * 60;
  const closeMinute = close ? minuteOfDay(`0000-00-00T${close}`) : 17 * 60;
  const isToday = date === todayIso();
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const columnAt = (clientX: number): number | undefined => {
    const index = columnsRef.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX < r.right;
    });
    return index >= 0 ? index : undefined;
  };

  // Mutarea: unde ar ajunge programarea trasa (ora rotunjita la 5 minute si coloana de sub mouse)
  const dropTarget = (a: Appointment, dy: number, clientX: number) => {
    const minutes = appointmentMinutes(a);
    const start = clampMinute(minuteOfDay(a.appointmentDate) + snap(dy / PX_PER_MIN, DRAG_STEP), minutes);
    const index = columnAt(clientX);
    const line = index !== undefined ? columns[index] : (a.line ?? null);
    return { start, line };
  };

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, line: number | null) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = START_HOUR * 60 + Math.floor((e.clientY - rect.top) / PX_PER_MIN / CLICK_STEP) * CLICK_STEP;
    onCreate(`${date}T${hhmm(clampMinute(minute, CLICK_STEP))}`, line);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onDateChange(shiftDay(date, -1))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Ziua de dinainte">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(todayIso())}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Azi
          </button>
          <button type="button" onClick={() => onDateChange(shiftDay(date, 1))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Ziua următoare">
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="hidden sm:block text-sm font-semibold text-slate-800">{dayLabel(date)}</p>
        <div className="ml-auto w-40">
          <DateField value={date} onChange={(v) => v && onDateChange(v)} />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="flex min-w-max">
          {/* Orele */}
          <div className="sticky left-0 z-20 w-12 shrink-0 bg-white">
            <div className={`sticky top-0 z-10 ${team.length ? 'h-[5.25rem]' : 'h-14'} bg-white border-b border-slate-200`} />
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="relative border-r border-slate-100">
                <span className="absolute -top-2 right-1.5 text-[11px] tabular-nums text-slate-400">{h}:00</span>
              </div>
            ))}
          </div>

          {columns.map((line, index) => {
            const list = byColumn[index];
            const busy = line === null ? null : occupancy(list, openMinute, closeMinute);
            return (
              <div key={line ?? 'none'} className="flex-1 min-w-[9.5rem] border-r border-slate-100 last:border-r-0">
                <div className={`sticky top-0 z-10 ${team.length ? 'h-[5.25rem]' : 'h-14'} px-2 flex flex-col justify-center bg-white border-b border-slate-200`}>
                  <p className={`truncate text-sm font-semibold ${line === null ? 'text-amber-700' : 'text-slate-800'}`}>
                    {line === null ? 'Fără linie liberă' : lineName(lineNames, line)}
                    {line !== null && line > lineNames.length && <span className="font-normal text-slate-400"> (scoasă)</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {list.length} {list.length === 1 ? 'programare' : 'programări'}
                    {busy !== null && ` · ${busy}% ocupat`}
                  </p>
                  {team.length > 0 && line !== null && line <= lineNames.length && (
                    <LineInspector
                      date={date}
                      shift={shifts.find((s) => s.line === line)}
                      team={team}
                      mode={resolved}
                      onChange={(id, reset) => onShiftChange(line, id, reset)}
                    />
                  )}
                </div>
                <div
                  ref={(el) => {
                    columnsRef.current[index] = el;
                  }}
                  onClick={(e) => handleColumnClick(e, line)}
                  className="relative cursor-pointer"
                  style={{
                    height: hours.length * HOUR_PX,
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--color-slate-100) 0, var(--color-slate-100) 1px, transparent 1px, transparent ${HOUR_PX / 2}px)`,
                  }}
                  title="Click pe un loc liber pentru o programare nouă"
                >
                  {/* In afara programului statiei */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-slate-100/60"
                    style={{ height: Math.max(0, (openMinute - START_HOUR * 60) * PX_PER_MIN) }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-100/60"
                    style={{ height: Math.max(0, (END_HOUR * 60 - closeMinute) * PX_PER_MIN) }}
                  />
                  {isToday && nowMinute >= START_HOUR * 60 && nowMinute < END_HOUR * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500" style={{ top: (nowMinute - START_HOUR * 60) * PX_PER_MIN }} />
                  )}

                  {list.map((a) => {
                    const minutes = appointmentMinutes(a);
                    const pos = layout[index].get(a.id) ?? { lane: 0, of: 1 };
                    const dragging = drag?.id === a.id && drag.moved;
                    const target = dragging ? { start: drag.start, line: drag.line } : null;
                    const startMinute = minuteOfDay(a.appointmentDate);
                    const canDrag = a.status === 'SCHEDULED';
                    const cls = a.source === 'ONLINE' && a.status === 'SCHEDULED' ? ONLINE_CLS : STATUS_CLS[a.status];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onPointerDown={(e) => {
                          if (!canDrag || e.pointerType === 'touch' || e.button !== 0) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDrag({ id: a.id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, start: minuteOfDay(a.appointmentDate), line: a.line ?? null });
                        }}
                        onPointerMove={(e) => {
                          if (drag?.id !== a.id) return;
                          const dx = e.clientX - drag.x;
                          const dy = e.clientY - drag.y;
                          setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4, ...dropTarget(a, dy, e.clientX) });
                        }}
                        onPointerUp={(e) => {
                          if (drag?.id !== a.id) return;
                          setDrag(null);
                          if (!drag.moved) return;
                          justMoved.current = true;
                          const t = dropTarget(a, e.clientY - drag.y, e.clientX);
                          if (t.start !== startMinute || t.line !== (a.line ?? null)) onMove(a, `${date}T${hhmm(t.start)}:00`, t.line);
                        }}
                        onPointerCancel={() => setDrag(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (justMoved.current) {
                            justMoved.current = false;
                            return;
                          }
                          onOpen(a);
                        }}
                        className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm transition-shadow hover:shadow-md ${cls} ${
                          canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${dragging ? 'z-30 opacity-90 shadow-lg ring-2 ring-blue-400' : 'z-0'}`}
                        style={{
                          top: (startMinute - START_HOUR * 60) * PX_PER_MIN + 1,
                          height: Math.max(minutes * PX_PER_MIN - 2, 18),
                          left: `calc(${(pos.lane * 100) / pos.of}% + 2px)`,
                          width: `calc(${100 / pos.of}% - 4px)`,
                          transform: dragging ? `translate(${drag.dx}px, ${snap(drag.dy / PX_PER_MIN, DRAG_STEP) * PX_PER_MIN}px)` : undefined,
                          touchAction: canDrag ? 'none' : undefined,
                        }}
                        title={`${hhmm(startMinute)} · ${minutes} min · ${a.clientName}${a.licensePlate ? ' · ' + a.licensePlate : ''}`}
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          <span className="tabular-nums">{target ? hhmm(target.start) : hhmm(startMinute)}</span>
                          {a.source === 'ONLINE' && <Globe size={11} className="shrink-0" />}
                          {a.itpRecordId && <CheckCircle2 size={11} className="shrink-0" />}
                          <span className="truncate">{a.clientName}</span>
                          {a.inspectorId != null && a.inspectorId !== a.lineInspectorId && (() => {
                            const who = team.find((i) => i.id === a.inspectorId);
                            return who ? (
                              <span
                                className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                                style={{ background: colorHex(who.color, resolved) }}
                                title={`Inspector: ${who.name}`}
                              >
                                {initials(who.name)}
                              </span>
                            ) : null;
                          })()}
                        </span>
                        {minutes >= 20 && (
                          <span className="block truncate opacity-80">
                            {[a.licensePlate, a.vehicleCategory ? VEHICLE_SHORT_LABELS[a.vehicleCategory] : null].filter(Boolean).join(' · ')}
                            {target && target.line !== (a.line ?? null) && ` → ${target.line === null ? 'fără linie' : lineName(lineNames, target.line)}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Inspectorul liniei in ziua afisata: cel ales pentru ziua asta, cel care lucreaza de obicei pe linie sau nimeni
function LineInspector({
  date,
  shift,
  team,
  mode,
  onChange,
}: {
  date: string;
  shift: LineShift | undefined;
  team: Inspector[];
  mode: 'light' | 'dark';
  onChange: (inspectorId: number | null, reset: boolean) => void;
}) {
  const who = team.find((i) => i.id === shift?.inspectorId);
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: who ? colorHex(who.color, mode) : 'var(--color-slate-300)' }} />
      <select
        value={shift?.source === 'DAY' ? (shift.inspectorId ?? 'none') : ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange(null, true);
          else onChange(v === 'none' ? null : Number(v), false);
        }}
        aria-label="Inspectorul liniei în ziua asta"
        className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">{shift?.source === 'DEFAULT' && who ? `${who.name} (automat)` : 'Nimeni (automat)'}</option>
        <option value="none">Nimeni azi</option>
        {team
          .filter((i) => i.active)
          .map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.leaves.some((l) => l.from <= date && date <= l.to) ? ' (absent)' : ''}
            </option>
          ))}
      </select>
    </div>
  );
}
