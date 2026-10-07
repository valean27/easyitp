import { describe, expect, it } from 'vitest';
import type { Appointment } from '../types';
import { dayColumns, hhmm, lanes, lineName, minuteOfDay, occupancy } from './lines';

const appt = (id: number, time: string, minutes: number, line: number | null): Appointment => ({
  id,
  clientName: 'Client ' + id,
  phone: null,
  licensePlate: null,
  appointmentDate: `2026-10-12T${time}:00`,
  status: 'SCHEDULED',
  durationMinutes: minutes,
  line,
});

describe('lines', () => {
  it('names lines with the station names or a default', () => {
    expect(lineName(['Autoturisme', ''], 1)).toBe('Autoturisme');
    expect(lineName(['Autoturisme', ''], 2)).toBe('Linia 2');
    expect(lineName(undefined, 3)).toBe('Linia 3');
  });

  it('converts times', () => {
    expect(minuteOfDay('2026-10-12T09:35:00')).toBe(575);
    expect(hhmm(575)).toBe('09:35');
  });

  it('adds columns for lines still in use and for appointments without a free line', () => {
    expect(dayColumns([appt(1, '09:00', 20, 1)], 2)).toEqual([1, 2]);
    expect(dayColumns([appt(1, '09:00', 20, 3), appt(2, '09:00', 20, null)], 2)).toEqual([1, 2, 3, null]);
  });

  it('puts overlapping appointments of a line side by side', () => {
    const l = lanes([appt(1, '09:00', 30, 1), appt(2, '09:10', 20, 1), appt(3, '09:30', 20, 1), appt(4, '11:00', 20, 1)]);
    expect(l.get(1)).toEqual({ lane: 0, of: 2 });
    expect(l.get(2)).toEqual({ lane: 1, of: 2 });
    expect(l.get(3)).toEqual({ lane: 0, of: 1 });
    expect(l.get(4)).toEqual({ lane: 0, of: 1 });
  });

  it('computes how busy a line is during opening hours', () => {
    expect(occupancy([appt(1, '07:50', 30, 1), appt(2, '12:00', 60, 1)], 8 * 60, 12 * 60)).toBe(8);
    expect(occupancy([], 0, 0)).toBe(0);
  });
});
