import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS_LONG, formatRo, inRange, maskRo, monthGrid, parseRo } from '../utils/dateField';
import { todayIso } from '../utils/dates';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const POPUP_W = 296;
const POPUP_H = 356;

// Camp de data in locul celui din browser: se poate tasta (zz.ll.aaaa, punctele se pun singure) sau alege din
// calendar. Valoarea e "aaaa-ll-zz" sau "" (gol). Calendarul e in document.body, ca sa nu fie taiat de
// cardurile / ferestrele cu overflow ascuns.
export default function DateField({
  value,
  onChange,
  min,
  max,
  required,
  placeholder = 'zz.ll.aaaa',
  className = '',
  name,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  name?: string;
}) {
  // null = afiseaza valoarea; text = ce tasteaza utilizatorul acum
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value || todayIso()));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const shown = draft ?? (value ? formatRo(value) : '');
  const today = todayIso();

  // calendarul sub camp, sau deasupra daca nu e loc; niciodata in afara ecranului
  const openAt = () => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom >= POPUP_H + 8 || r.top < POPUP_H + 8;
    setPos({
      top: below ? r.bottom + 4 : r.top - POPUP_H - 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - POPUP_W - 8)),
    });
    setView(monthOf(value || (max && today > max ? max : today)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const close = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const pick = (iso: string) => {
    onChange(iso);
    setDraft(null);
    setOpen(false);
  };

  const type = (text: string) => {
    const masked = maskRo(text);
    setDraft(masked);
    if (masked === '') onChange('');
    const iso = parseRo(masked);
    if (iso && inRange(iso, min, max)) {
      onChange(iso);
      setView(monthOf(iso));
    }
  };

  const minYear = min ? Number(min.slice(0, 4)) : Number(today.slice(0, 4)) - 30;
  const maxYear = max ? Number(max.slice(0, 4)) : Number(today.slice(0, 4)) + 20;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const invalid = draft !== null && draft !== '' && (() => {
    const iso = parseRo(draft);
    return !iso || !inRange(iso, min, max);
  })();

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        name={name}
        value={shown}
        required={required}
        placeholder={placeholder}
        onChange={(e) => type(e.target.value)}
        onBlur={() => setDraft(null)}
        onFocus={(e) => e.target.select()}
        aria-invalid={invalid || undefined}
        className={`${className} pr-10 ${invalid ? 'border-red-300 focus:ring-red-400' : ''}`}
      />
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openAt())}
        aria-label="Alege din calendar"
        aria-expanded={open}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
      >
        <CalendarDays size={17} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Calendar"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPUP_W }}
            className="z-[1000] rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-slate-700"
          >
            <div className="flex items-center gap-1 mb-2">
              <button type="button" onClick={() => step(-1)} aria-label="Luna anterioară" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronLeft size={17} />
              </button>
              <select
                value={view.m}
                onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
                aria-label="Luna"
                className="flex-1 min-w-0 rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold capitalize hover:bg-slate-100 focus:outline-none"
              >
                {MONTHS_LONG.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={view.y}
                onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
                aria-label="Anul"
                className="rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold hover:bg-slate-100 focus:outline-none"
              >
                {(years.includes(view.y) ? years : [view.y, ...years]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => step(1)} aria-label="Luna următoare" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-slate-400 mb-1">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthGrid(view.y, view.m).map((c) => {
                const selected = c.iso === value;
                const allowed = inRange(c.iso, min, max);
                return (
                  <button
                    key={c.iso}
                    type="button"
                    disabled={!allowed}
                    onClick={() => pick(c.iso)}
                    className={`h-9 rounded-lg text-sm tabular-nums transition-colors disabled:opacity-25 disabled:pointer-events-none ${
                      selected
                        ? 'bg-blue-600 text-white font-semibold'
                        : c.iso === today
                          ? 'text-blue-600 font-bold ring-1 ring-inset ring-blue-200 hover:bg-blue-50'
                          : c.inMonth
                            ? 'hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={!inRange(today, min, max)}
                onClick={() => pick(today)}
                className="px-2.5 py-1 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              >
                Azi
              </button>
              {!required && value && (
                <button type="button" onClick={() => pick('')} className="px-2.5 py-1 rounded-lg text-sm text-slate-500 hover:bg-slate-100">
                  Șterge
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function monthOf(iso: string): { y: number; m: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 };
}
