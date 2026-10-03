import { useState } from 'react';
import { X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ManagerSummary } from '../types';
import { createUser, updateManager, resetManagerPassword } from '../api/adminApi';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          {footer}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

function FooterButtons({ formId, loading, onClose, label }: { formId: string; loading: boolean; onClose: () => void; label: string }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        Anulează
      </button>
      <button
        form={formId}
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {label}
      </button>
    </>
  );
}

function PasswordField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Minim 6 caractere"
          className={INPUT_CLS + ' font-mono'}
        />
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          title="Generează parolă"
        >
          <RefreshCw size={14} />
          Generează
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">Transmite parola managerului în mod securizat.</p>
    </div>
  );
}

interface ManagerFormProps {
  manager?: ManagerSummary;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ManagerFormModal({ manager, onClose, onSuccess }: ManagerFormProps) {
  const isEdit = !!manager;
  const [email, setEmail] = useState(manager?.email ?? '');
  const [password, setPassword] = useState(() => (isEdit ? '' : generatePassword()));
  const [stationName, setStationName] = useState(manager?.stationName ?? '');
  const [address, setAddress] = useState(manager?.address ?? '');
  const [phone, setPhone] = useState(manager?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const station = { stationName, address, phone };
    try {
      if (manager) {
        await updateManager(manager.id, station);
        onSuccess(`Datele stației ${stationName || manager.email} au fost actualizate.`);
      } else {
        await createUser({ email, password, ...station });
        onSuccess(`Contul pentru ${email} a fost creat. Parola: ${password}`);
      }
      onClose();
    } catch (err) {
      setError(
        errorStatus(err) === 409
          ? 'Email-ul este deja înregistrat.'
          : 'Eroare la salvare. Verificați datele și încercați din nou.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? 'Editează Stația' : 'Adaugă Manager Nou'}
      onClose={onClose}
      footer={<FooterButtons formId="manager-form" loading={loading} onClose={onClose} label={isEdit ? 'Salvează' : 'Creează Cont'} />}
    >
      <form id="manager-form" onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Cont</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={isEdit}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@statie-itp.ro"
              className={INPUT_CLS + ' disabled:bg-slate-50 disabled:text-slate-500'}
            />
          </div>
          {!isEdit && <PasswordField value={password} onChange={setPassword} label="Parolă temporară" />}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Stație ITP</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nume stație</label>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="ITP Auto Center Cluj"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Adresă</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Str. Exemplu nr. 1, Cluj-Napoca"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Telefon stație</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07xx xxx xxx"
              className={INPUT_CLS}
            />
          </div>
        </fieldset>

        {error && <ErrorBox message={error} />}
      </form>
    </ModalShell>
  );
}

interface ResetPasswordProps {
  manager: ManagerSummary;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ResetPasswordModal({ manager, onClose, onSuccess }: ResetPasswordProps) {
  const [password, setPassword] = useState(() => generatePassword());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetManagerPassword(manager.id, password);
      onSuccess(`Parola pentru ${manager.email} a fost resetată. Parola nouă: ${password}`);
      onClose();
    } catch {
      setError('Eroare la resetarea parolei.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Resetează Parola"
      onClose={onClose}
      footer={<FooterButtons formId="reset-form" loading={loading} onClose={onClose} label="Resetează" />}
    >
      <form id="reset-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Setezi o parolă nouă pentru <span className="font-semibold">{manager.email}</span>. Managerul o poate schimba
          apoi din „Contul meu”.
        </p>
        <PasswordField value={password} onChange={setPassword} label="Parolă nouă" />
        {error && <ErrorBox message={error} />}
      </form>
    </ModalShell>
  );
}
