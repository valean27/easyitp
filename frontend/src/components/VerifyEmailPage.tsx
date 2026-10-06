import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { verifyEmail } from '../api/authApi';
import { apiMessage } from '../utils/errors';
import { useAuth } from '../context/auth';
import AuthCard, { AuthMessage } from './AuthCard';

// Linkul din emailul de bun venit (/confirmare-email?token=...): confirma adresa, cu sau fara login
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { isAuthenticated } = useAuth();
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(
    token ? null : { type: 'error', text: 'Linkul de confirmare nu este complet. Deschideți-l din email.' },
  );
  // StrictMode ruleaza efectul de doua ori in dezvoltare; linkul se poate folosi o singura data
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    verifyEmail(token)
      .then((text) => setResult({ type: 'success', text }))
      .catch((err) => setResult({ type: 'error', text: apiMessage(err, 'Adresa nu a putut fi confirmată. Încercați din nou.') }));
  }, [token]);

  return (
    <AuthCard title="Confirmarea adresei de email">
      {!result ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Se confirmă...
        </div>
      ) : (
        <div className="space-y-4">
          <AuthMessage type={result.type} text={result.text} />
          <Link to={isAuthenticated ? '/' : '/login'} className="block w-full text-center py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            {isAuthenticated ? 'Înapoi în aplicație' : 'Intră în cont'}
          </Link>
          {result.type === 'error' && isAuthenticated && (
            <p className="text-center text-xs text-slate-500">Un link nou se poate cere din banda de sus a aplicației.</p>
          )}
        </div>
      )}
    </AuthCard>
  );
}
