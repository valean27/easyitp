import { describe, expect, it } from 'vitest';
import { apptLabel, merge, withPending, type OutboxItem } from './outbox';
import type { Appointment } from '../types';

const at = '2026-10-09T10:00:00.000Z';
const appt = (id: number, time: string, extra: Partial<Appointment> = {}): Appointment =>
  ({ id, clientName: `C${id}`, phone: null, licensePlate: null, appointmentDate: `2026-10-09T${time}:00`, status: 'SCHEDULED', ...extra }) as Appointment;

describe('outbox merge', () => {
  const create: OutboxItem = { ref: 'r1', kind: 'create', id: -1, payload: { clientName: 'Ion', appointmentDate: '2026-10-09T10:00:00' }, label: 'Ion', at };

  it('folds edits and deletes of an offline-created appointment into the create', () => {
    const edited = merge([create], { ref: 'r2', kind: 'update', id: -1, payload: { appointmentDate: '2026-10-09T11:00:00' }, label: 'Ion · 11', at });
    expect(edited).toHaveLength(1);
    expect(edited[0].payload).toMatchObject({ clientName: 'Ion', appointmentDate: '2026-10-09T11:00:00' });
    expect(merge(edited, { ref: 'r3', kind: 'delete', id: -1, label: 'Ion', at })).toEqual([]);
  });

  it('keeps the last edit of a server appointment on the first base version', () => {
    const first: OutboxItem = { ref: 'u1', kind: 'update', id: 7, version: 3, payload: { clientName: 'A' }, label: 'A', at };
    const second: OutboxItem = { ref: 'u2', kind: 'update', id: 7, version: 3, payload: { clientName: 'B' }, label: 'B', at };
    const out = merge([first], second);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ref: 'u2', version: 3, payload: { clientName: 'B' } });
    const deleted = merge(out, { ref: 'd1', kind: 'delete', id: 7, version: 4, label: 'B', at });
    expect(deleted).toEqual([expect.objectContaining({ kind: 'delete', version: 3 })]);
  });
});

describe('withPending', () => {
  it('shows queued changes on top of the server list', () => {
    const list = [appt(1, '09:00'), appt(2, '10:00'), appt(3, '12:00')];
    const items: OutboxItem[] = [
      { ref: 'c', kind: 'create', id: -5, payload: { clientName: 'Nou', appointmentDate: '2026-10-09T11:00:00', status: 'SCHEDULED' }, label: '', at },
      { ref: 'c2', kind: 'create', id: -6, payload: { clientName: 'Maine', appointmentDate: '2026-10-10T11:00:00', status: 'SCHEDULED' }, label: '', at },
      { ref: 'u', kind: 'update', id: 2, payload: { appointmentDate: '2026-10-09T13:00:00' }, label: '', at },
      { ref: 'd', kind: 'delete', id: 3, label: '', at },
      { ref: 's', kind: 'status', id: 1, payload: { status: 'NO_SHOW' }, label: '', at },
    ];
    const shown = withPending(list, items, '2026-10-09');
    expect(shown.map((a) => [a.id, a.appointmentDate.slice(11, 16), a.status, !!a.pending])).toEqual([
      [1, '09:00', 'NO_SHOW', true],
      [-5, '11:00', 'SCHEDULED', true],
      [2, '13:00', 'SCHEDULED', true],
    ]);
  });

  it('labels appointments', () => {
    expect(apptLabel({ clientName: 'Ion Pop', appointmentDate: '2026-10-09T10:30:00' })).toBe('Ion Pop · 09.10 10:30');
  });
});
