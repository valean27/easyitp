import { useState } from 'react';
import axios from 'axios';
import { X, Loader2, KeyRound, Trash2 } from 'lucide-react';
import type { Fleet } from '../types';
import { createFleet, deleteFleetAccount, saveFleetAccount, updateFleet } from '../api/fleetApi';
import { parsePlates } from '../utils/fleet';

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function serverMessage(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;
}

interface Props {
  fleet?: Fleet;
  onClose: () => void;
  onSaved: (fleet: Fleet) => void;
}

// Firma (date, numere de inmatriculare) si contul ei de acces in portal
export default function FleetModal({ fleet, onClose, onSaved }: Props) {
  const [name, setName] = useState(fleet?.name ?? '');
  const [cui, setCui] = useState(fleet?.cui ?? '');
  const [contactName, setContactName] = useState(fleet?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(fleet?.contactPhone ?? '');
  const [address, setAddress] = useState(fleet?.address ?? '');
  const [city, setCity] = useState(fleet?.city ?? '');
  const [county, setCounty] = useState(fleet?.county ?? '');
  const [platesText, setPlatesText] = useState(fleet?.plates.join('\n') ?? '');
  const [email, setEmail] = useState(fleet?.accountEmail ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plates = parsePlates(platesText);
  const hasAccount = !!fleet?.accountEmail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = {
        name,
        cui: cui || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        address: address || null,
        city: city || null,
        county: county || null,
        plates,
      };
      let saved = fleet ? await updateFleet(fleet.id, data) : await createFleet(data);
      // Contul se salveaza doar daca s-a completat ceva nou
      const emailChanged = email.trim() && email.trim().toLowerCase() !== (fleet?.accountEmail ?? '');
      if (emailChanged || password) {
        try {
          saved = await saveFleetAccount(saved.id, email.trim(), password);
        } catch (err) {
          onSaved(saved);
          setError(`Firma a fost salvată, dar contul nu: ${serverMessage(err) ?? 'eroare'}`);
          return;
        }
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(serverMessage(err) ?? 'Firma nu a putut fi salvată.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!fleet || !confirm(`Ștergeți contul ${fleet.accountEmail}? Firma nu se va mai putea loga.`)) return;
    try {
      const saved = await deleteFleetAccount(fleet.id);
      setEmail('');
      onSaved(saved);
    } catch {
      setError('Contul nu a putut fi șters.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-800">{fleet ? 'Editează firma' : 'Firmă nouă'}</h2>
          <button onClick={onClose} aria-label="Închide" className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <form id="fleet-form" onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nume firmă <span className="text-red-500">*</span>
              </label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Fan Courier Cluj" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">CUI</label>
              <input value={cui} onChange={(e) => setCui(e.target.value)} placeholder="RO12345678" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Persoană de contact</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon contact</label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="07xx xxx xxx" className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Adresa firmei (pentru factură)</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Str. Fabricii 12" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Localitatea</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cluj-Napoca" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Județul</label>
              <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Cluj" className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Mașinile firmei <span className="font-normal text-slate-400">({plates.length})</span>
            </label>
            <textarea
              value={platesText}
              onChange={(e) => setPlatesText(e.target.value)}
              rows={6}
              placeholder={'Un număr pe linie (sau separate prin virgulă):\nCJ 01 ABC\nCJ 02 ABC'}
              className={INPUT_CLS + ' font-mono uppercase resize-y'}
            />
            <p className="text-xs text-slate-400 mt-1">
              Poți lipi lista din Excel. ITP-urile acestor numere, făcute oricând la stație, apar automat în portalul firmei.
            </p>
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-3 space-y-3">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-slate-600">
              <KeyRound size={14} /> Acces în portal
            </legend>
            <p className="text-xs text-slate-400 -mt-1">
              Firma se loghează cu aceste date pe aceeași pagină de login și vede doar mașinile ei.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="flota@firma.ro" autoComplete="off" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{hasAccount ? 'Parolă nouă' : 'Parolă'}</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasAccount ? 'lasă gol ca s-o păstrezi' : 'minim 6 caractere'}
                autoComplete="off"
                className={INPUT_CLS}
              />
            </div>
            {hasAccount && (
              <button type="button" onClick={handleDeleteAccount} className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700">
                <Trash2 size={13} /> Șterge contul firmei
              </button>
            )}
          </fieldset>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            Anulează
          </button>
          <button
            form="fleet-form"
            type="submit"
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}
