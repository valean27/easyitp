import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Download, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { deleteAccount, exportAllData } from '../api/accountApi';
import { useAuth } from '../context/auth';
import { apiMessage } from '../utils/errors';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';

// Contul meu → Datele stației (GDPR): descarcarea tuturor datelor si stergerea contului (30 de zile pana la stergerea
// definitiva, timp in care se poate anula scriindu-ne)
export default function AccountDataCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    setExporting(true);
    try {
      await exportAllData();
    } catch (err) {
      setError(apiMessage(err, 'Datele nu au putut fi descărcate.'));
    } finally {
      setExporting(false);
    }
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      const message = await deleteAccount(password, confirm);
      logout();
      navigate(`/login?info=${encodeURIComponent(message)}`, { replace: true });
    } catch (err) {
      setError(apiMessage(err, 'Contul nu a putut fi șters.'));
      setDeleting(false);
    }
  };

  return (
    <SettingsCard id="date" icon={<Database size={15} />} title="Datele stației și ștergerea contului" summary="Descărcare sau ștergere">
      <div className="px-6 py-5 space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Descărcați tot ce are stația în Easy ITP (clienți, mașini, ITP-uri, programări, flote, termene, facturi, istoric) într-un
            fișier JSON. Pentru Excel folosiți „Export CSV” din prima pagină.
          </p>
          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Descarcă toate datele
          </button>
        </div>

        <form onSubmit={remove} className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Trash2 size={15} /> Ștergerea contului
          </p>
          <p className="text-sm text-slate-600">
            Contul se închide imediat. Toate datele stației se șterg definitiv după 30 de zile; până atunci ne puteți scrie ca să-l
            redeschidem. Descărcați datele înainte.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parola contului"
            autoComplete="current-password"
            aria-label="Parola contului"
            className={INPUT_CLS}
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Scrieți STERGE ca să confirmați"
            aria-label="Confirmare"
            className={INPUT_CLS}
          />
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={deleting || !password || !confirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <Loader2 size={15} className="animate-spin" />}
            Șterge contul
          </button>
        </form>
      </div>
    </SettingsCard>
  );
}
