import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Car, LayoutDashboard, Users, LogOut, CalendarDays, UserCog, BellRing, BarChart3, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/auth';

interface NavItem {
  to: string;
  label: string;
  short: string; // eticheta din bara de jos pe telefon
  icon: LucideIcon;
  end?: boolean;
}

// Adminul nu are statie proprie: vede doar managerii si rapoartele
const MANAGER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Acasă', icon: LayoutDashboard, end: true },
  { to: '/reminders', label: 'De contactat', short: 'Contactați', icon: BellRing },
  { to: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { to: '/reports', label: 'Rapoarte', short: 'Rapoarte', icon: BarChart3 },
  { to: '/account', label: 'Contul meu', short: 'Cont', icon: UserCog },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/users', label: 'Manageri', short: 'Manageri', icon: Users },
  { to: '/reports', label: 'Rapoarte', short: 'Rapoarte', icon: BarChart3 },
  { to: '/account', label: 'Contul meu', short: 'Cont', icon: UserCog },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = user?.role === 'ADMIN' ? ADMIN_NAV : MANAGER_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-600'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
    }`;

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
      isActive ? 'text-blue-600' : 'text-slate-500'
    }`;

  return (
    <div className="flex h-dvh bg-slate-50 overflow-hidden">
      {/* Meniu lateral (tableta si desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-slate-200 flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Car size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">EasyITP</p>
            <p className="text-xs text-slate-400 leading-tight">Inspecții Tehnice</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-1">
            Navigare
          </p>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navCls}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.email}</p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.stationName || 'Manager ITP'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              title="Deconectare"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>

        {/* Bara de navigare de jos (telefon) */}
        <nav
          className="md:hidden shrink-0 flex bg-white border-t border-slate-200"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {items.map(({ to, short, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={tabCls}>
              <Icon size={20} />
              {short}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
