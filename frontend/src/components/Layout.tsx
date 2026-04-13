import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Car, LayoutDashboard, Users, LogOut, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Car size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">EasyITP</p>
            <p className="text-xs text-slate-400 leading-tight">Inspecții Tehnice</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-1">
            Navigare
          </p>
          <NavLink to="/" end className={navCls}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink to="/calendar" className={navCls}>
            <CalendarDays size={16} />
            Calendar
          </NavLink>

          {user?.role === 'ADMIN' && (
            <NavLink to="/users" className={navCls}>
              <Users size={16} />
              Utilizatori
            </NavLink>
          )}
        </nav>

        {/* User card + Logout */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.email}</p>
              <p className="text-xs text-slate-400">
                {user?.role === 'ADMIN' ? 'Administrator' : 'Manager ITP'}
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
