import { useEffect, useState } from 'react';
import { MailWarning, Loader2 } from 'lucide-react';
import { getProfile, resendVerification } from '../api/accountApi';
import { useAuth } from '../context/auth';
import { apiMessage } from '../utils/errors';

// Banda de sus pentru statiile care nu si-au confirmat emailul (fara el nu ajung resetarea parolei si anunturile)
export default function EmailVerifyBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'MANAGER') return;
    getProfile()
      .then((p) => setShow(p.emailVerified === false))
      .catch(() => setShow(false));
  }, [user?.role]);

  if (!show) return null;

  const resend = async () => {
    setBusy(true);
    try {
      setNote(await resendVerification());
    } catch (err) {
      setNote(apiMessage(err, 'Emailul nu a putut fi trimis.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm bg-amber-50 text-amber-800 border-b border-amber-200">
      <MailWarning size={15} className="shrink-0" />
      <span>
        {note ?? (
          <>
            Confirmați adresa <b>{user?.email}</b> din emailul primit, ca să puteți reseta parola și primi anunțurile.
          </>
        )}
      </span>
      {!note && (
        <button onClick={resend} disabled={busy} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 disabled:opacity-60">
          {busy && <Loader2 size={13} className="animate-spin" />}
          Retrimite emailul
        </button>
      )}
    </div>
  );
}
