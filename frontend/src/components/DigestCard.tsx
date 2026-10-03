import { useEffect, useState } from 'react';
import axios from 'axios';
import { Mail, Loader2, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getProfile, sendTestDigest, updateDigest } from '../api/accountApi';
import { useAuth } from '../context/auth';

type Message = { text: string; type: 'success' | 'error' } | null;

// Emailul de dimineata cu programarile zilei si clientii de contactat
export default function DigestCard() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    getProfile()
      .then((p) => setEnabled(p.digestEnabled))
      .catch(() => setEnabled(true));
  }, []);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    setSaving(true);
    setMessage(null);
    try {
      await updateDigest(value);
    } catch {
      setEnabled(!value);
      setMessage({ text: 'Setarea nu a putut fi salvată.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setSending(true);
    setMessage(null);
    try {
      await sendTestDigest();
      setMessage({ text: `Email trimis la ${user?.email}. Verifică și folderul Spam.`, type: 'success' });
    } catch (err) {
      const serverMessage = axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;
      setMessage({ text: serverMessage ?? 'Emailul nu a putut fi trimis.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Mail size={15} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-700">Email zilnic</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled ?? true}
            disabled={enabled === null || saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            <span className="font-medium">Primesc dimineața un rezumat pe email</span>
            <span className="block text-xs text-slate-400">
              Luni–sâmbătă, la {user?.email}: programările zilei, programările online noi și clienții cărora le expiră
              ITP-ul. Dacă nu e nimic de raportat, emailul nu se trimite.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={handleTest}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Trimite un email de test acum
        </button>

        {message && (
          <div
            className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
              message.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-600 bg-red-50 border-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
