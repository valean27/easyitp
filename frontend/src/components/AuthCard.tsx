import { Link } from 'react-router-dom';
import { Car, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const AUTH_INPUT =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Cadrul paginilor de cont fara login (parola uitata, resetare, confirmarea emailului), ca pagina de login
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Înapoi la autentificare
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        <Link to="/" className="flex flex-col items-center gap-2" title="Pagina principală">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Car size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 text-center">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 text-center">{subtitle}</p>}
        </Link>
        {children}
      </div>
    </div>
  );
}

export function AuthMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  const ok = type === 'success';
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
        ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
      }`}
    >
      {ok ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
      {text}
    </div>
  );
}
