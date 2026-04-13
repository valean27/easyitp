import { useState } from 'react';
import { UserPlus, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { createUser } from '../api/adminApi';

export default function UserManagementPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    setLoading(true);
    try {
      await createUser(email, password);
      setSuccess(`Contul pentru ${email} a fost creat cu succes.`);
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError('Email-ul este deja înregistrat.');
      } else {
        setError('Eroare la crearea contului. Încercați din nou.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">
              Gestionare Utilizatori
            </h1>
            <p className="text-xs text-slate-400 leading-tight">
              Creează conturi pentru manageri ITP
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <UserPlus size={15} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-700">Adaugă Manager Nou</h2>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@statie-itp.ro"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Parolă temporară
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minim 6 caractere"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {success && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  {success}
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Se creează...
                  </>
                ) : (
                  <>
                    <UserPlus size={15} />
                    Creează Cont Manager
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-4 text-xs text-slate-400 px-1">
            Conturile create au rolul de <span className="font-semibold">Manager</span> și pot
            gestiona propriile înregistrări ITP. Transmite credențialele managerului în mod securizat.
          </p>
        </div>
      </main>
    </div>
  );
}
