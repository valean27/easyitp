import type { DeadlineDates, DeadlineKind } from '../types';
import { DEADLINE_KINDS } from '../utils/deadlines';

// RCA / rovinieta / tahograf: trei date optionale (formularul ITP si fisa clientului)
export default function DeadlineFields({
  value,
  onChange,
  inputCls,
}: {
  value: DeadlineDates;
  onChange: (next: DeadlineDates) => void;
  inputCls: string;
}) {
  const set = (kind: DeadlineKind, date: string) => onChange({ ...value, [kind]: date });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {DEADLINE_KINDS.map(({ kind, label, hint }) => (
        <label key={kind} className="text-xs text-slate-500" title={hint}>
          {label}
          <input type="date" value={value[kind] ?? ''} onChange={(e) => set(kind, e.target.value)} className={`${inputCls} mt-1`} />
        </label>
      ))}
    </div>
  );
}
