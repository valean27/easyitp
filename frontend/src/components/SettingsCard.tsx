import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

// O sectiune din Contul meu: inchisa la inceput, se deschide / inchide din titlu. Sub titlu, o stare scurta
// ("Pornită", "3 inspectori"). Un link /account#<id> o deschide direct.
export default function SettingsCard({
  id,
  icon,
  title,
  summary,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const targeted = !!id && location.hash === `#${id}`;
  // null = neatinsa de utilizator: urmeaza linkul (#id), si cand se schimba pe aceeasi pagina
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? targeted;
  const ref = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  useEffect(() => {
    if (targeted) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [targeted]);

  return (
    <div id={id} ref={ref} className="scroll-mt-20 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-800">{title}</span>
          {summary && <span className="block text-xs text-slate-500 truncate">{summary}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* ramane montata cand e inchisa: ce ai scris nesalvat nu se pierde */}
      <div id={bodyId} hidden={!open} className="border-t border-slate-100">
        {children}
      </div>
    </div>
  );
}
