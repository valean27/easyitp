import { useEffect, useState } from 'react';
import { X, Loader2, Pencil, Trash2, ArrowRightLeft, Merge, Phone, Car, Check, Star } from 'lucide-react';
import { getProfile } from '../api/accountApi';
import { normalizePhone, whatsappLink } from '../utils/reminderMessage';
import { reviewMessage } from '../utils/review';
import {
  deleteClient,
  deleteVehicle,
  getClient,
  mergeClient,
  setClientConsent,
  moveVehicle,
  updateClient,
  updateVehicle,
} from '../api/clientApi';
import type { ClientDetail, ClientVehicle, DeadlineDates, Profile, ReminderConsent, VehicleUpdate } from '../types';
import { deadlinePayload, deadlineSummary } from '../utils/deadlines';
import DeadlineFields from './DeadlineFields';
import { STATUS_LABELS, formatDateRo } from '../utils/fleet';
import { apiMessage } from '../utils/errors';
import ClientPicker from './ClientPicker';
import { offerUndo } from '../utils/undo';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

function VehicleForm({ vehicle, onSave, onCancel }: {
  vehicle: ClientVehicle;
  onSave: (data: VehicleUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    licensePlate: vehicle.licensePlate,
    brand: vehicle.brand,
    model: vehicle.model ?? '',
    year: vehicle.year?.toString() ?? '',
    vin: vehicle.vin ?? '',
  });
  const [deadlines, setDeadlines] = useState<DeadlineDates>(vehicle.deadlines ?? {});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        licensePlate: form.licensePlate,
        brand: form.brand,
        model: form.model.trim() || null,
        year: form.year.trim() ? Number(form.year) : null,
        vin: form.vin.trim() || null,
        deadlines: deadlinePayload(deadlines),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 mt-2">
      <label className="col-span-2 sm:col-span-1 text-xs text-slate-500">
        Nr. înmatriculare
        <input value={form.licensePlate} onChange={set('licensePlate')} className={`${inputCls} font-mono uppercase mt-1`} />
      </label>
      <label className="col-span-2 sm:col-span-1 text-xs text-slate-500">
        Marcă
        <input value={form.brand} onChange={set('brand')} className={`${inputCls} mt-1`} />
      </label>
      <label className="text-xs text-slate-500">
        Model
        <input value={form.model} onChange={set('model')} className={`${inputCls} mt-1`} />
      </label>
      <label className="text-xs text-slate-500">
        An
        <input value={form.year} onChange={set('year')} inputMode="numeric" className={`${inputCls} mt-1`} />
      </label>
      <label className="col-span-2 text-xs text-slate-500">
        VIN
        <input value={form.vin} onChange={set('vin')} className={`${inputCls} font-mono uppercase mt-1`} />
      </label>
      <div className="col-span-2">
        <p className="text-xs font-medium text-slate-500 mb-1">Alte scadențe (opțional)</p>
        <DeadlineFields value={deadlines} onChange={setDeadlines} inputCls={inputCls} />
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
          Renunță
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Salvează
        </button>
      </div>
    </form>
  );
}

const CONSENT_TEXT: Record<'GIVEN' | 'DECLINED' | 'UNKNOWN', { label: string; cls: string }> = {
  GIVEN: { label: 'De acord cu remindere', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  DECLINED: { label: 'Nu dorește mesaje', cls: 'text-red-700 bg-red-50 border-red-200' },
  UNKNOWN: { label: 'Acord necunoscut', cls: 'text-slate-600 bg-slate-50 border-slate-200' },
};

// Acordul GDPR pentru remindere: starea, de unde vine si butoanele de schimbare
function ConsentRow({ client, busy, onChange }: {
  client: ClientDetail;
  busy: boolean;
  onChange: (consent: ReminderConsent | null) => void;
}) {
  const state = CONSENT_TEXT[client.consent ?? 'UNKNOWN'];
  const btn = 'px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${state.cls}`}>{state.label}</span>
      {client.consentSource && client.consentAt && (
        <span className="text-xs text-slate-400">
          {client.consentSource} · {formatDateRo(client.consentAt.slice(0, 10))}
        </span>
      )}
      <span className="flex gap-1.5 ml-auto">
        {client.consent !== 'GIVEN' && (
          <button disabled={busy} onClick={() => onChange('GIVEN')} className={btn}>Și-a dat acordul</button>
        )}
        {client.consent !== 'DECLINED' && (
          <button disabled={busy} onClick={() => onChange('DECLINED')} className={btn}>Nu dorește mesaje</button>
        )}
      </span>
    </div>
  );
}

// Fisa clientului: datele lui, masinile cu istoricul ITP si actiunile (editare, mutare, unire, stergere)
export default function ClientModal({
  clientId,
  onClose,
  onChanged,
}: {
  clientId: number;
  onClose: () => void;
  // lista din spate trebuie reincarcata
  onChanged: () => void;
}) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<number | null>(null);
  const [movingVehicle, setMovingVehicle] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  // pentru butonul "Cere o recenzie" (linkul de recenzie Google al statiei)
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    getClient(clientId)
      .then(setClient)
      .catch((err) => setError(apiMessage(err, 'Clientul nu a putut fi încărcat.')));
  }, [clientId]);

  // Rezultatul unei actiuni: noua fisa (poate a altui client, dupa mutare/unire) sau inchidere daca a disparut
  const run = async (action: () => Promise<ClientDetail | null | void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      onChanged();
      if (next) setClient(next);
      else onClose();
      return true;
    } catch (err) {
      setError(apiMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    if (!client) return;
    setName(client.name);
    setPhone(client.phone ?? '');
    setEditingClient(true);
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const ok = await run(() => updateClient(client.id, { name, phone: phone.trim() || null }), 'Clientul nu a putut fi salvat.');
    if (ok) setEditingClient(false);
  };

  // Fara confirmare: stergerea se poate anula din bara de jos sau din Istoric
  const removeClient = () => {
    if (!client) return;
    run(async () => {
      const eventId = await deleteClient(client.id);
      offerUndo(`Clientul ${client.name} a fost șters`, eventId, onChanged);
    }, 'Clientul nu a putut fi șters.');
  };

  const removeVehicle = (v: ClientVehicle) => {
    run(async () => {
      const { client: next, eventId } = await deleteVehicle(v.id);
      offerUndo(`Mașina ${v.licensePlate.toUpperCase()} a fost ștearsă`, eventId, onChanged);
      return next;
    }, 'Mașina nu a putut fi ștearsă.');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Fișa clientului</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200" title="Închide">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {!client ? (
            !error && (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )
          ) : (
            <>
              {editingClient ? (
                <form onSubmit={saveClient} className="space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nume" className={inputCls} />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" inputMode="tel" className={inputCls} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingClient(false)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                      Renunță
                    </button>
                    <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                      Salvează
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-slate-800 break-words">{client.name}</p>
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 mt-0.5">
                        <Phone size={13} /> {client.phone}
                      </a>
                    ) : (
                      <p className="text-sm text-slate-400 mt-0.5">Fără telefon</p>
                    )}
                    {profile?.reviewUrl && normalizePhone(client.phone) && client.consent !== 'DECLINED' && (
                      <a
                        href={whatsappLink(normalizePhone(client.phone)!, reviewMessage(client.name, profile.stationName, profile.reviewUrl))}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-3 inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                        title="Deschide WhatsApp cu mesajul de recenzie"
                      >
                        <Star size={13} /> Cere o recenzie
                      </a>
                    )}
                  </div>
                  <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 shrink-0">
                    <Pencil size={14} /> Editează
                  </button>
                </div>
              )}

              <ConsentRow
                client={client}
                busy={busy}
                onChange={(consent) => run(() => setClientConsent(client.id, consent), 'Acordul nu a putut fi salvat.')}
              />

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Mașini ({client.vehicles.length})
                </p>
                {client.vehicles.map((v) => (
                  <div key={v.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-slate-800">{v.licensePlate.toUpperCase()}</p>
                        <p className="text-sm text-slate-500">
                          {[v.brand, v.model, v.year ? `(${v.year})` : null].filter(Boolean).join(' ')}
                          {v.vin && <span className="font-mono text-xs"> · {v.vin}</span>}
                        </p>
                        {deadlineSummary(v.deadlines) && (
                          <p className="text-xs text-slate-500 mt-0.5">{deadlineSummary(v.deadlines)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => { setEditingVehicle(v.id); setMovingVehicle(null); }} title="Editează mașina" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => { setMovingVehicle(v.id); setEditingVehicle(null); }} title="Mută la alt client" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                          <ArrowRightLeft size={15} />
                        </button>
                        <button onClick={() => removeVehicle(v)} disabled={busy} title="Șterge mașina" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {editingVehicle === v.id && (
                      <VehicleForm
                        vehicle={v}
                        onCancel={() => setEditingVehicle(null)}
                        onSave={async (data) => {
                          if (await run(() => updateVehicle(v.id, data), 'Mașina nu a putut fi salvată.')) setEditingVehicle(null);
                        }}
                      />
                    )}
                    {movingVehicle === v.id && (
                      <div className="mt-2">
                        <ClientPicker
                          excludeId={client.id}
                          actionLabel="Mută aici"
                          onCancel={() => setMovingVehicle(null)}
                          onPick={async (target) => {
                            if (!confirm(`Mutați mașina ${v.licensePlate} la ${target.name}?`)) return;
                            if (await run(() => moveVehicle(v.id, target.id), 'Mașina nu a putut fi mutată.')) setMovingVehicle(null);
                          }}
                        />
                      </div>
                    )}

                    {v.itps.length > 0 ? (
                      <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
                        {v.itps.map((itp, i) => (
                          <li key={itp.id} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 ${i === 0 ? 'bg-slate-50' : ''}`}>
                            <span className="font-medium text-slate-700">{formatDateRo(itp.testDate)}</span>
                            <span className="text-slate-500">{itp.validityMonths} luni</span>
                            <span className={itp.status === 'FAILED' ? 'text-red-600' : itp.status === 'RECHECK' ? 'text-amber-600' : 'text-emerald-600'}>
                              {STATUS_LABELS[itp.status]}
                            </span>
                            <span className="text-slate-500 text-xs ml-auto">
                              {i === 0 ? `valabil până la ${formatDateRo(itp.nextItpDate)}` : ''}
                              {itp.mileage != null ? `${i === 0 ? ' · ' : ''}${itp.mileage.toLocaleString('ro-RO')} km` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1"><Car size={12} /> Fără ITP-uri</p>
                    )}
                  </div>
                ))}
              </div>

              {merging && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Alegeți clientul care este de fapt aceeași persoană. Mașinile lui {client.name} trec la el, iar fișa aceasta dispare.
                  </p>
                  <ClientPicker
                    excludeId={client.id}
                    actionLabel="Unește"
                    onCancel={() => setMerging(false)}
                    onPick={async (target) => {
                      if (!confirm(`Unim ${client.name} cu ${target.name}? Toate mașinile trec la ${target.name}.`)) return;
                      if (await run(() => mergeClient(client.id, target.id), 'Clienții nu au putut fi uniți.')) setMerging(false);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {client && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <button onClick={removeClient} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={15} /> Șterge clientul
            </button>
            <button onClick={() => setMerging(true)} disabled={busy || merging} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Merge size={15} /> Unește cu alt client
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
