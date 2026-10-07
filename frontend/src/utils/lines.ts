import type { Appointment } from '../types';
import { appointmentMinutes } from './appointments';

// Liniile ITP ale statiei in calendar (vederea "Pe linii") si in formularul programarii

// Numele liniei: cel ales de statie sau "Linia N"
export function lineName(names: string[] | undefined, line: number): string {
  return names?.[line - 1]?.trim() || `Linia ${line}`;
}

// Minutul din zi la care incepe programarea ("yyyy-MM-ddTHH:mm...")
export function minuteOfDay(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

// "HH:mm" dintr-un minut al zilei
export function hhmm(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snap(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

// Coloanele zilei: liniile statiei, liniile mai mari inca folosite (dupa ce s-au micsorat liniile) si,
// daca e cazul, coloana programarilor care nu mai incap pe nicio linie (null)
export function dayColumns(appts: Appointment[], lines: number): (number | null)[] {
  const max = appts.reduce((m, a) => Math.max(m, a.line ?? 0), lines);
  const columns: (number | null)[] = Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
  if (appts.some((a) => a.line == null)) columns.push(null);
  return columns;
}

// Pozitia in coloana pentru programarile care se suprapun pe aceeasi linie: banda si cate benzi are grupul
export function lanes(appts: Appointment[]): Map<number, { lane: number; of: number }> {
  const sorted = [...appts].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.id - b.id);
  const span = (a: Appointment) => {
    const start = minuteOfDay(a.appointmentDate);
    return { start, end: start + appointmentMinutes(a) };
  };
  const result = new Map<number, { lane: number; of: number }>();
  let group: Appointment[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const close = () => {
    const of = laneEnds.length;
    group.forEach((a) => result.set(a.id, { lane: result.get(a.id)!.lane, of }));
    group = [];
    laneEnds = [];
  };
  for (const a of sorted) {
    const { start, end } = span(a);
    if (start >= groupEnd) {
      close();
      groupEnd = -1;
    }
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    result.set(a.id, { lane, of: 1 });
    group.push(a);
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return result;
}

// Cat din programul zilei e ocupat pe linie (0-100)
export function occupancy(appts: Appointment[], openMinute: number, closeMinute: number): number {
  const total = closeMinute - openMinute;
  if (total <= 0) return 0;
  const busy = appts.reduce((sum, a) => {
    const start = Math.max(minuteOfDay(a.appointmentDate), openMinute);
    const end = Math.min(minuteOfDay(a.appointmentDate) + appointmentMinutes(a), closeMinute);
    return sum + Math.max(0, end - start);
  }, 0);
  return Math.min(100, Math.round((busy * 100) / total));
}
