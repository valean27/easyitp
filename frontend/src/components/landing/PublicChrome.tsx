import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Menu, X } from 'lucide-react';
import ThemeSwitcher from '../ThemeSwitcher';
import { COMPANY } from '../../utils/company';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="bg-blue-600 p-2 rounded-lg">
        <Car size={18} className="text-white" />
      </span>
      <span className="text-lg font-extrabold text-slate-900">Easy ITP</span>
    </Link>
  );
}

// Antetul paginilor publice; `links` = ancore sau pagini, afisate pe desktop si in meniul de pe telefon
export function PublicHeader({ links }: { links: { href: string; label: string }[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const item = (l: { href: string; label: string }, cls: string, onClick?: () => void) =>
    l.href.startsWith('#') ? (
      <a key={l.href} href={l.href} onClick={onClick} className={cls}>{l.label}</a>
    ) : (
      <Link key={l.href} to={l.href} onClick={onClick} className={cls}>{l.label}</Link>
    );
  const demo = window.location.pathname === '/' ? '#demo' : '/#demo';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {links.map((l) => item(l, 'hover:text-slate-900'))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-28">
            <ThemeSwitcher compact />
          </div>
          <Link to="/login" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Intră în cont
          </Link>
          <a href={demo} className="hidden sm:inline-flex px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Cere o demonstrație
          </a>
          <button onClick={() => setMenuOpen((o) => !o)} className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Meniu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1 bg-white">
          {links.map((l) => item(l, 'block px-2 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50', () => setMenuOpen(false)))}
          <div className="py-2"><ThemeSwitcher /></div>
          <div className="grid grid-cols-2 gap-2 pt-1 sm:hidden">
            <Link to="/login" className="text-center px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700">Intră în cont</Link>
            <a href={demo} onClick={() => setMenuOpen(false)} className="text-center px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">Cere demo</a>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-slate-500">
        <div className="space-y-3">
          <Logo />
          <p>Evidență ITP, remindere SMS și programări online pentru stații ITP.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-700">Pagini</p>
          <Link to="/statii" className="block hover:text-slate-800">Stații ITP cu programare online</Link>
          <Link to="/login" className="block hover:text-slate-800">Intră în cont</Link>
          <Link to="/confidentialitate" className="block hover:text-slate-800">Politica de confidențialitate</Link>
          <Link to="/termeni" className="block hover:text-slate-800">Termeni și condiții</Link>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-700">Contact</p>
          <p>{COMPANY.name}</p>
          <p>CUI {COMPANY.cui}</p>
          <a href={COMPANY.phoneHref} className="block hover:text-slate-800">Tel. {COMPANY.phone}</a>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {COMPANY.name} · Easy ITP
      </p>
    </footer>
  );
}
