import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, CheckCircle2, Circle, ArrowRight, Lightbulb, Lock } from 'lucide-react';
import { usePlan } from '../context/plan';
import { FEATURE_PLAN, PLAN_LABELS } from '../utils/plans';
import { FIRST_STEPS, GUIDE, matches, type GuideSection } from '../utils/guide';
import { COMPANY } from '../utils/company';

const DONE_KEY = 'guide_done';

function readDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function Section({ s }: { s: GuideSection }) {
  const { has } = usePlan();
  const locked = s.feature && !has(s.feature);
  return (
    <section id={s.id} className="scroll-mt-24 bg-white rounded-xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
        {s.feature && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            {PLAN_LABELS[FEATURE_PLAN[s.feature]]}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.intro}</p>
      {s.steps && (
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {s.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}
      {s.tips && (
        <ul className="mt-4 space-y-1.5 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
          {s.tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" />
              {tip}
            </li>
          ))}
        </ul>
      )}
      {locked && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <Lock size={13} /> Pachetul stației nu include încă această funcție.{' '}
          <Link to="/account#abonament" className="font-semibold underline">Vezi pachetele</Link>
        </p>
      )}
      {s.links && (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.links.map((l) => (
            <Link
              key={l.to + l.label}
              to={l.to}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {l.label} <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// Ghidul de utilizare pentru statie: primii pasi (bifati pe dispozitiv), cuprins, cautare si cate o sectiune pe functie
export default function GuidePage() {
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<string[]>(readDone);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        // fara stocare locala bifele raman doar pana la reincarcare
      }
      return next;
    });
  };

  const groups = useMemo(
    () => GUIDE.map((g) => ({ ...g, sections: g.sections.filter((s) => matches(s, query)) })).filter((g) => g.sections.length > 0),
    [query],
  );
  const doneCount = FIRST_STEPS.filter((s) => done.includes(s.id)).length;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BookOpen size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight">Ghid de utilizare</h1>
            <p className="text-xs text-slate-400 leading-tight truncate">Cum scoateți maximum din Easy ITP</p>
          </div>
          <div className="relative hidden sm:block w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută în ghid (ex. SMS, import)"
              aria-label="Caută în ghid"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-6 items-start">
        <nav className="hidden lg:block sticky top-24 space-y-4 text-sm" aria-label="Cuprins">
          {GUIDE.map((g) => (
            <div key={g.title}>
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>
              <ul className="mt-1">
                {g.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-slate-600 hover:bg-white hover:text-slate-900">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-6 min-w-0 max-w-3xl">
          <div className="relative sm:hidden">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută în ghid (ex. SMS, import)"
              aria-label="Caută în ghid"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!query && (
            <section className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">Primii pași</h2>
                <span className="text-sm text-slate-500 tabular-nums">
                  {doneCount} / {FIRST_STEPS.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${(doneCount / FIRST_STEPS.length) * 100}%` }} />
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {FIRST_STEPS.map((step) => {
                  const isDone = done.includes(step.id);
                  return (
                    <li key={step.id} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(step.id)}
                        aria-pressed={isDone}
                        aria-label={isDone ? 'Marchează ca nefăcut' : 'Marchează ca făcut'}
                        className="shrink-0 text-blue-600"
                      >
                        {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} className="text-slate-300" />}
                      </button>
                      <span className={`flex-1 text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step.text}</span>
                      <Link to={step.link.to} className="shrink-0 text-sm font-medium text-blue-600 hover:underline">
                        {step.link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {groups.length === 0 && <p className="text-sm text-slate-500">Nu am găsit nimic pentru „{query}”.</p>}
          {groups.map((g) => (
            <div key={g.title} className="space-y-3">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{g.title}</h2>
              {g.sections.map((s) => (
                <Section key={s.id} s={s} />
              ))}
            </div>
          ))}

          <p className="text-sm text-slate-500">
            Aveți o întrebare la care ghidul nu răspunde? Scrieți-ne la{' '}
            <a href={`mailto:${COMPANY.email}`} className="font-semibold text-blue-600 hover:underline">{COMPANY.email}</a> sau sunați la{' '}
            <a href={COMPANY.phoneHref} className="font-semibold text-blue-600 hover:underline">{COMPANY.phone}</a>; vă ajutăm și la
            importul clienților sau la configurarea SMS-urilor.
          </p>
        </div>
      </main>
    </div>
  );
}
