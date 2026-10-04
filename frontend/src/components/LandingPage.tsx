import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Car,
  MessageSquareText,
  CalendarClock,
  ScanLine,
  BellRing,
  BarChart3,
  Truck,
  Users,
  ShieldCheck,
  Mail,
  FileSpreadsheet,
  Smartphone,
  ArrowRight,
  ClipboardCheck,
  Repeat,
  Menu,
  X,
} from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import PhoneMockup from './landing/PhoneMockup';
import RoiCalculator from './landing/RoiCalculator';
import DemoForm from './landing/DemoForm';
import Faq from './landing/Faq';

const NAV = [
  { href: '#functionalitati', label: 'Funcționalități' },
  { href: '#cum-functioneaza', label: 'Cum funcționează' },
  { href: '#calculator', label: 'Calculator' },
  { href: '#intrebari', label: 'Întrebări' },
];

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string; points: string[] }[] = [
  {
    icon: MessageSquareText,
    title: 'Remindere SMS automate',
    text: 'Clientul primește singur un SMS înainte să-i expire ITP-ul, cu link de programare.',
    points: ['De pe telefonul stației sau prin gateway', 'La termenele alese (ex. 30 și 7 zile)', 'Doar clienților cu acord, cu link de dezabonare'],
  },
  {
    icon: CalendarClock,
    title: 'Programare online 24/7',
    text: 'O pagină de programare a stației, pe care o puneți pe Google Maps, Facebook sau în SMS.',
    points: ['Doar intervalele libere', 'Durată diferită pe tip de vehicul', 'Ține cont de câte linii are stația'],
  },
  {
    icon: ScanLine,
    title: 'Scanarea talonului',
    text: 'Fotografiați talonul cu telefonul: numărul, VIN-ul, marca, modelul și anul se completează singure.',
    points: ['Mai puține greșeli de tastare', 'Client cunoscut? Datele vin din ultimul ITP', 'Poza nu se păstrează'],
  },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BellRing, title: 'Listă „De contactat”', text: 'Cine expiră săptămâna asta, cu WhatsApp, SMS și apel dintr-o atingere.' },
  { icon: Users, title: 'Clienți și istoric', text: 'Un client cu toate mașinile lui și istoricul ITP al fiecăreia; dublurile se unesc ușor.' },
  { icon: CalendarClock, title: 'Calendar', text: 'Programările zilei și ale săptămânii; cele online apar singure.' },
  { icon: BarChart3, title: 'Rapoarte pentru patron', text: 'Încasări pe lună, rata de respingere pe inspector, clienții care nu s-au mai întors.' },
  { icon: Truck, title: 'Portal pentru flote', text: 'Firmele își văd mașinile, scadențele și centralizatorul lunar.' },
  { icon: Mail, title: 'Rezumat de dimineață', text: 'Pe email sau WhatsApp: programările zilei și cine trebuie sunat.' },
  { icon: FileSpreadsheet, title: 'Import și export Excel', text: 'Aduceți clienții existenți și scoateți oricând datele, pentru contabilitate.' },
  { icon: ShieldCheck, title: 'GDPR și istoric', text: 'Acordul clientului e înregistrat; orice modificare sau ștergere se poate vedea și anula.' },
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardCheck, title: 'Introduceți ITP-ul', text: 'Din formular, din poza talonului sau dintr-un fișier Excel cu clienții existenți.' },
  { icon: BellRing, title: 'Aplicația urmărește scadența', text: 'Știe când expiră fiecare ITP și cine trebuie anunțat.' },
  { icon: Repeat, title: 'Clientul revine', text: 'Primește SMS-ul la timp și se programează online sau sună la stație.' },
];

const SCREENS: { src: string; title: string; wide: boolean }[] = [
  { src: '/landing/dashboard.png', title: 'Evidența ITP-urilor', wide: true },
  { src: '/landing/programare.png', title: 'Programarea online, pe telefon', wide: false },
  { src: '/landing/rapoarte.png', title: 'Rapoarte pentru patron', wide: true },
  { src: '/landing/contactat.png', title: 'Lista „De contactat”', wide: false },
];

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-10">
      <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">{eyebrow}</p>
      <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h2>
      {text && <p className="mt-3 text-slate-600">{text}</p>}
    </div>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="bg-blue-600 p-2 rounded-lg">
        <Car size={18} className="text-white" />
      </span>
      <span className="text-lg font-extrabold text-slate-900">Easy ITP</span>
    </Link>
  );
}

// Pagina de prezentare pentru vizitatorii nelogati (statii ITP interesate)
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-slate-900">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block w-28">
              <ThemeSwitcher compact />
            </div>
            <Link to="/login" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Intră în cont
            </Link>
            <a href="#demo" className="hidden sm:inline-flex px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              Cere o demonstrație
            </a>
            <button onClick={() => setMenuOpen((o) => !o)} className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Meniu">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-100 px-4 py-3 space-y-1 bg-white">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="block px-2 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                {n.label}
              </a>
            ))}
            <div className="py-2"><ThemeSwitcher /></div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link to="/login" className="text-center px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700">Intră în cont</Link>
              <a href="#demo" onClick={() => setMenuOpen(false)} className="text-center px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">Cere demo</a>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Prima sectiune */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-transparent dark:from-[#10213f]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                <Smartphone size={13} /> Pentru stații ITP din România
              </p>
              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-tight text-slate-900">
                Clienții revin singuri la <span className="text-blue-600">ITP</span>
              </h1>
              <p className="mt-5 text-lg text-slate-600 leading-relaxed">
                Easy ITP ține evidența inspecțiilor, trimite SMS-uri înainte de expirare și primește programări online.
                Mai puține telefoane, mai puțini clienți pierduți la concurență.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a href="#demo" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                  Cere o demonstrație <ArrowRight size={18} />
                </a>
                <a href="#cum-functioneaza" className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50">
                  Vezi cum funcționează
                </a>
              </div>
              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
                <li className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600 shrink-0" /> Fără instalare</li>
                <li className="flex items-center gap-2"><Smartphone size={16} className="text-emerald-600 shrink-0" /> Merge și pe telefon</li>
                <li className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-emerald-600 shrink-0" /> Import din Excel</li>
              </ul>
            </div>
            <PhoneMockup />
          </div>
        </section>

        {/* Ce face, pe scurt */}
        <section id="functionalitati" className="scroll-mt-20 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle eyebrow="Funcționalități" title="Tot ce face o stație ITP, într-un singur loc" text="Făcut pentru munca de zi cu zi de la ghișeu: mai puțin tastat, mai puține telefoane." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, text, points }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2"><span className="text-blue-600">•</span>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <Icon size={18} className="text-blue-600" />
                  <p className="mt-2 font-semibold text-slate-800">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cum functioneaza */}
        <section id="cum-functioneaza" className="scroll-mt-20 py-16 sm:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle eyebrow="Cum funcționează" title="Trei pași, fără bătăi de cap" />
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative rounded-2xl bg-white border border-slate-200 p-6">
                  <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">Pasul {i + 1}</span>
                  <Icon size={22} className="text-blue-600" />
                  <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="scroll-mt-20 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle eyebrow="Calculator" title="Cât valorează clienții care nu se mai întorc?" text="Mutați cursoarele după cifrele stației și vedeți cât venit pot aduce reminderele." />
            <RoiCalculator />
          </div>
        </section>

        {/* Capturi din aplicatie */}
        <section className="py-16 sm:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle eyebrow="Din aplicație" title="Simplu de folosit, și la ghișeu, și de pe telefon" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              {SCREENS.map((s) => (
                <figure key={s.src} className={`rounded-2xl border border-slate-200 bg-white p-2 shadow-sm ${s.wide ? 'md:col-span-2' : ''}`}>
                  {/* aceeasi inaltime pe rand: captura lata 16:10 pe doua coloane = captura de telefon 4:5 pe una */}
                  <img src={s.src} alt={s.title} loading="lazy" className={`w-full rounded-xl border border-slate-100 ${s.wide ? 'aspect-[16/10]' : 'aspect-[4/5]'} object-cover object-top`} />
                  <figcaption className="px-2 pt-2 pb-1 text-sm font-medium text-slate-600">{s.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Preturi */}
        <section id="preturi" className="scroll-mt-20 py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionTitle eyebrow="Prețuri" title="Un abonament lunar, fără instalare" text="Pregătim pachetele. Cereți o demonstrație și vă facem o ofertă potrivită mărimii stației." />
            <a href="#demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
              Cere oferta <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* Intrebari */}
        <section id="intrebari" className="scroll-mt-20 py-16 sm:py-20 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <SectionTitle eyebrow="Întrebări frecvente" title="Ce ne întreabă stațiile" />
            <Faq />
          </div>
        </section>

        {/* Cerere de demonstratie */}
        <section id="demo" className="scroll-mt-20 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Demonstrație</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Vedeți aplicația pe datele stației dumneavoastră</h2>
              <p className="mt-4 text-slate-600">
                Lăsați-ne un telefon sau un email. Vă arătăm cum ar arăta stația în Easy ITP și vă ajutăm să importați clienții
                existenți.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2"><ClipboardCheck size={17} className="text-blue-600 shrink-0" /> Import din Excel făcut împreună</li>
                <li className="flex gap-2"><MessageSquareText size={17} className="text-blue-600 shrink-0" /> SMS-urile configurate de pe telefonul stației</li>
                <li className="flex gap-2"><CalendarClock size={17} className="text-blue-600 shrink-0" /> Pagina de programare gata de pus pe Google Maps</li>
              </ul>
            </div>
            <DemoForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <Logo />
          <p>© {new Date().getFullYear()} Easy ITP · Evidență ITP, remindere și programări online</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-slate-800">Intră în cont</Link>
            <a href="#demo" className="hover:text-slate-800">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
