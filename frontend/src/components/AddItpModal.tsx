import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CreatableSelect from 'react-select/creatable';
import type { SingleValue } from 'react-select';
import { X, Loader2, History, Camera, ScanLine, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DashboardEntry, DeadlineDates, ItpFormData, ItpStatus } from '../types';
import { createItpEntry, updateItpEntry, lookupByPlate, scanRegistration, getDeadlinesForPlate } from '../api/itpApi';
import { deadlinePayload, deadlineSummary } from '../utils/deadlines';
import DeadlineFields from './DeadlineFields';
import { shrinkImage } from '../utils/image';
import { todayIso } from '../utils/dates';
import { getMakes, createMake, getModels, createModel } from '../api/carApi';
import { getInspectors } from '../api/accountApi';
import type { CarMake, CarModel } from '../api/carApi';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  // Daca e setat, modalul editeaza inregistrarea existenta
  entry?: DashboardEntry;
  // Date precompletate la adaugare (ex. dintr-o programare)
  prefill?: Partial<ItpFormData>;
  // Programarea din care se face ITP-ul; devine "Finalizat" la salvare
  appointmentId?: number;
}

type SelectOption = { value: number; label: string };

const CURRENT_YEAR = new Date().getFullYear();

const rsStyles = {
  control: (base: object, state: { isFocused: boolean }) => ({
    ...base,
    borderRadius: '0.5rem',
    backgroundColor: 'var(--surface)',
    borderColor: state.isFocused ? 'transparent' : 'var(--color-slate-200, #e2e8f0)',
    boxShadow: state.isFocused ? '0 0 0 2px #3b82f6' : '0 0 0 1px var(--color-slate-200, #e2e8f0)',
    fontSize: '0.875rem',
    minHeight: '38px',
    '&:hover': { borderColor: 'var(--color-slate-300, #cbd5e1)' },
  }),
  option: (base: object, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    fontSize: '0.875rem',
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? 'var(--color-slate-100, #f1f5f9)' : 'var(--surface)',
    color: state.isSelected ? 'white' : 'var(--color-slate-800, #1e293b)',
    cursor: 'pointer',
  }),
  menu: (base: object) => ({
    ...base,
    backgroundColor: 'var(--surface)',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,.25), 0 0 0 1px var(--color-slate-200, #e2e8f0)',
  }),
  placeholder: (base: object) => ({ ...base, color: 'var(--color-slate-400, #94a3b8)', fontSize: '0.875rem' }),
  singleValue: (base: object) => ({ ...base, fontSize: '0.875rem', color: 'var(--color-slate-800, #1e293b)' }),
  input: (base: object) => ({ ...base, color: 'var(--color-slate-800, #1e293b)' }),
};

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// Ultimul inspector ales pe acest dispozitiv (de obicei fiecare inspector are telefonul lui)
const INSPECTOR_KEY = 'easyitp_inspector';

function rememberedInspector(): string {
  try {
    return localStorage.getItem(INSPECTOR_KEY) ?? '';
  } catch {
    return '';
  }
}

const emptyForm: ItpFormData = {
  name: '',
  phone: '',
  brand: '',
  model: '',
  year: null,
  vin: '',
  licensePlate: '',
  testDate: '',
  validityMonths: 12,
  status: 'PASSED',
  mileage: null,
  price: null,
  observations: '',
};

function formFromEntry(entry: DashboardEntry): ItpFormData {
  return {
    name: entry.numeSofer ?? '',
    phone: entry.contact ?? '',
    brand: entry.marca ?? '',
    model: entry.model ?? '',
    year: entry.year,
    vin: entry.vin ?? '',
    licensePlate: entry.numarInmatriculare ?? '',
    testDate: entry.dataItp,
    validityMonths: entry.valabilitateLuni,
    status: entry.status,
    mileage: entry.mileage,
    price: entry.price,
    observations: entry.observations ?? '',
    inspector: entry.inspector ?? '',
    // bifa pornita doar daca acordul exista; neatinsa = acordul nu se schimba
    ...(entry.reminderConsent === 'GIVEN' ? { reminderConsent: true } : {}),
  };
}

export default function AddItpModal({ onClose, onSuccess, entry, prefill, appointmentId }: Props) {
  const isEdit = !!entry;
  const [form, setForm] = useState<ItpFormData>(() =>
    entry ? formFromEntry(entry) : { ...emptyForm, testDate: todayIso(), ...prefill }
  );
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  // Clientul a cerut sa nu mai primeasca mesaje (link STOP sau marcat de statie)
  const [declined, setDeclined] = useState(entry?.reminderConsent === 'DECLINED');
  const [lastLookup, setLastLookup] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<{ text: string; warnings: string[]; type: 'success' | 'error' } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [inspectors, setInspectors] = useState<string[]>([]);
  // RCA / rovinieta / tahograf ale masinii; se trimit doar daca au fost atinse in formular
  const [deadlines, setDeadlines] = useState<DeadlineDates>({});
  const [deadlinesTouched, setDeadlinesTouched] = useState(false);
  const [showDeadlines, setShowDeadlines] = useState(false);

  useEffect(() => {
    if (!entry?.numarInmatriculare) return;
    getDeadlinesForPlate(entry.numarInmatriculare)
      .then(setDeadlines)
      .catch(() => setDeadlines({}));
  }, [entry]);

  // Lista de inspectori a statiei; la un ITP nou preselectam inspectorul folosit ultima data pe acest dispozitiv
  useEffect(() => {
    getInspectors()
      .then((list) => {
        setInspectors(list);
        const last = rememberedInspector();
        if (!entry && list.includes(last)) setForm((f) => ({ ...f, inspector: f.inspector || last }));
      })
      .catch(() => setInspectors([]));
  }, [entry]);

  const [makeOptions, setMakeOptions] = useState<SelectOption[]>([]);
  const [modelOptions, setModelOptions] = useState<SelectOption[]>([]);
  const [selectedMake, setSelectedMake] = useState<SingleValue<SelectOption>>(null);
  const [selectedModel, setSelectedModel] = useState<SingleValue<SelectOption>>(null);
  const [makesLoading, setMakesLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Preselecteaza marca si modelul (la editare sau dupa cautarea dupa numar)
  const selectMakeModel = async (options: SelectOption[], brand: string, model: string | null) => {
    const make = options.find((o) => o.label.toLowerCase() === brand.toLowerCase());
    if (!make) {
      setSelectedMake({ value: -1, label: brand });
      setSelectedModel(model ? { value: -1, label: model } : null);
      return;
    }
    setSelectedMake(make);
    setModelsLoading(true);
    try {
      const models: CarModel[] = await getModels(make.value);
      const modelOpts = models.map((m) => ({ value: m.id, label: m.name }));
      setModelOptions(modelOpts);
      if (model) {
        const found = modelOpts.find((o) => o.label.toLowerCase() === model.toLowerCase());
        setSelectedModel(found ?? { value: -1, label: model });
      } else {
        setSelectedModel(null);
      }
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    getMakes()
      .then(async (data: CarMake[]) => {
        const options = data.map((m) => ({ value: m.id, label: m.name }));
        setMakeOptions(options);
        if (entry?.marca) await selectMakeModel(options, entry.marca, entry.model);
      })
      .catch(() => setMakeOptions([]))
      .finally(() => setMakesLoading(false));
  }, [entry]);

  useEffect(() => {
    if (!isEdit && prefill?.licensePlate && !makesLoading) handlePlateBlur();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makesLoading]);

  // Client care revine: completam datele vehiculului din ultimul lui ITP (doar campurile goale)
  const handlePlateBlur = () => lookupPlate(form.licensePlate, !form.brand);

  const lookupPlate = async (rawPlate: string, brandEmpty: boolean) => {
    const plate = rawPlate.trim();
    if (isEdit || plate.length < 4 || plate === lastLookup) return;
    setLastLookup(plate);
    try {
      const prev = await lookupByPlate(plate);
      if (!prev) {
        setLookupNote(null);
        return;
      }
      setForm((f) => ({
        ...f,
        name: f.name || prev.numeSofer,
        phone: f.phone || prev.contact || '',
        brand: f.brand || prev.marca,
        model: f.model || prev.model || '',
        year: f.year ?? prev.year,
        vin: f.vin || prev.vin || '',
        validityMonths: prev.valabilitateLuni,
        reminderConsent: f.reminderConsent ?? (prev.reminderConsent === 'GIVEN' ? true : undefined),
      }));
      setDeclined(prev.reminderConsent === 'DECLINED');
      if (!deadlinesTouched) getDeadlinesForPlate(plate).then(setDeadlines).catch(() => undefined);
      if (brandEmpty && prev.marca) await selectMakeModel(makeOptions, prev.marca, prev.model);
      setLookupNote(`Client cunoscut: ultimul ITP pe ${prev.dataItp}. Datele vehiculului au fost completate.`);
    } catch {
      setLookupNote(null);
    }
  };

  // Poza talonului -> numar, VIN, marca, model, an; numele titularului doar daca numele e gol
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanNote(null);
    try {
      const scan = await scanRegistration(await shrinkImage(file));
      setForm((f) => ({
        ...f,
        licensePlate: scan.licensePlate ?? f.licensePlate,
        vin: scan.vin ?? f.vin,
        brand: scan.brand ?? f.brand,
        model: scan.brand ? scan.model ?? '' : f.model,
        year: scan.year ?? f.year,
      }));
      if (scan.brand) await selectMakeModel(makeOptions, scan.brand, scan.model);
      // Client care revine: numele si telefonul vin din ultimul ITP, altfel numele titularului de pe talon
      if (scan.licensePlate) await lookupPlate(scan.licensePlate, !scan.brand && !form.brand);
      if (scan.ownerName) setForm((f) => ({ ...f, name: f.name || scan.ownerName! }));
      setScanNote({ text: 'Date completate din talon. Verifică-le înainte de salvare.', warnings: scan.warnings, type: 'success' });
    } catch (err) {
      const message = axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message : undefined;
      setScanNote({ text: message ?? 'Talonul nu a putut fi citit. Încearcă din nou.', warnings: [], type: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const loadModels = async (makeId: number) => {
    setModelsLoading(true);
    setModelOptions([]);
    setSelectedModel(null);
    setForm((prev) => ({ ...prev, model: '' }));
    try {
      const data: CarModel[] = await getModels(makeId);
      setModelOptions(data.map((m) => ({ value: m.id, label: m.name })));
    } catch {
      setModelOptions([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleMakeChange = async (option: SingleValue<SelectOption>) => {
    setSelectedMake(option);
    setSelectedModel(null);
    setForm((prev) => ({ ...prev, brand: option?.label ?? '', model: '' }));
    if (option) loadModels(option.value);
    else setModelOptions([]);
  };

  const handleMakeCreate = async (inputValue: string) => {
    const created = await createMake(inputValue);
    const opt: SelectOption = { value: created.id, label: created.name };
    setMakeOptions((prev) => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)));
    setSelectedMake(opt);
    setSelectedModel(null);
    setForm((prev) => ({ ...prev, brand: created.name, model: '' }));
    loadModels(created.id);
  };

  const handleModelChange = (option: SingleValue<SelectOption>) => {
    setSelectedModel(option);
    setForm((prev) => ({ ...prev, model: option?.label ?? '' }));
  };

  const handleModelCreate = async (inputValue: string) => {
    if (!selectedMake) return;
    // Marca veche care nu exista in dictionar: pastram modelul doar ca text
    if (selectedMake.value < 0) {
      setSelectedModel({ value: -1, label: inputValue });
      setForm((prev) => ({ ...prev, model: inputValue }));
      return;
    }
    const created = await createModel(inputValue, selectedMake.value);
    const opt: SelectOption = { value: created.id, label: created.name };
    setModelOptions((prev) => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)));
    setSelectedModel(opt);
    setForm((prev) => ({ ...prev, model: created.name }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'inspector') {
      try {
        localStorage.setItem(INSPECTOR_KEY, value);
      } catch {
        /* stocare indisponibila */
      }
    }
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'validityMonths'
          ? Number(value)
          : name === 'year' || name === 'mileage' || name === 'price'
          ? value === ''
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = deadlinesTouched ? { ...form, deadlines: deadlinePayload(deadlines) } : form;
      if (entry) {
        await updateItpEntry(entry.id, data);
      } else {
        await createItpEntry({ ...data, appointmentId });
      }
      onSuccess();
      onClose();
    } catch {
      setError('A apărut o eroare. Verificați datele și încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-800">
            {isEdit ? 'Editează Înregistrare ITP' : appointmentId ? 'ITP din Programare' : 'Adaugă Înregistrare ITP'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="add-itp-form" onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            {!isEdit && (
              <div>
                <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} />
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={scanning}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-70 transition-colors"
                >
                  {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {scanning ? 'Se citește talonul...' : 'Scanează talonul'}
                </button>
                {scanNote && (
                  <div
                    className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 border ${
                      scanNote.type === 'success'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                        : 'text-red-600 bg-red-50 border-red-200'
                    }`}
                  >
                    <p className="flex items-center gap-1.5">
                      {scanNote.type === 'success' ? <ScanLine size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                      {scanNote.text}
                    </p>
                    {scanNote.warnings.map((w) => (
                      <p key={w} className="mt-1 text-amber-700">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Numarul primul: pentru clientii care revin completeaza restul datelor */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nr. Înmatriculare <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="licensePlate"
                required
                autoFocus={!isEdit && !form.licensePlate}
                value={form.licensePlate}
                onChange={handleChange}
                onBlur={handlePlateBlur}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                placeholder="B 123 ABC"
                className={INPUT_CLS + ' uppercase font-mono font-semibold'}
              />
              {lookupNote && (
                <p className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 mt-2">
                  <History size={12} className="shrink-0" />
                  {lookupNote}
                </p>
              )}
            </div>

            {/* Driver */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Date Șofer
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Nume Șofer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ion Popescu"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="07xx xxx xxx"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </fieldset>

            {/* Vehicle */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Date Vehicul
              </legend>

              {/* Make + Model row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Creatable Make */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Marcă <span className="text-red-500">*</span>
                  </label>
                  <CreatableSelect<SelectOption>
                    options={makeOptions}
                    value={selectedMake}
                    onChange={handleMakeChange}
                    onCreateOption={handleMakeCreate}
                    isLoading={makesLoading}
                    isClearable
                    placeholder="Selectează sau adaugă..."
                    formatCreateLabel={(v) => `Adaugă "${v}"`}
                    noOptionsMessage={() => 'Tastează pentru a adăuga'}
                    classNamePrefix="rs"
                    menuPlacement="auto"
                    styles={rsStyles}
                  />
                  {/* hidden required sentinel */}
                  <input
                    tabIndex={-1}
                    required
                    value={form.brand}
                    onChange={() => {}}
                    style={{ opacity: 0, height: 0, position: 'absolute' }}
                  />
                </div>

                {/* Creatable Model */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Model</label>
                  <CreatableSelect<SelectOption>
                    options={modelOptions}
                    value={selectedModel}
                    onChange={handleModelChange}
                    onCreateOption={handleModelCreate}
                    isLoading={modelsLoading}
                    isDisabled={!selectedMake}
                    isClearable
                    placeholder={selectedMake ? 'Selectează sau adaugă...' : '— alege mai întâi marca —'}
                    formatCreateLabel={(v) => `Adaugă "${v}"`}
                    noOptionsMessage={() => 'Tastează pentru a adăuga'}
                    classNamePrefix="rs"
                    menuPlacement="auto"
                    styles={rsStyles}
                  />
                </div>
              </div>

              {/* Year + VIN row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    An fabricație
                  </label>
                  <input
                    type="number"
                    name="year"
                    inputMode="numeric"
                    value={form.year ?? ''}
                    onChange={handleChange}
                    placeholder={String(CURRENT_YEAR)}
                    min={1900}
                    max={CURRENT_YEAR + 1}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">VIN</label>
                  <input
                    type="text"
                    name="vin"
                    value={form.vin}
                    onChange={handleChange}
                    placeholder="17 caractere (opțional)"
                    maxLength={17}
                    className={INPUT_CLS + ' font-mono uppercase'}
                  />
                </div>
              </div>
            </fieldset>

            {/* ITP data */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Date ITP
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Data Efectuare ITP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="testDate"
                    required
                    value={form.testDate}
                    onChange={handleChange}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Valabilitate <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="validityMonths"
                    required
                    value={form.validityMonths}
                    onChange={handleChange}
                    className={INPUT_CLS + ' bg-white'}
                  >
                    <option value={6}>6 luni</option>
                    <option value={12}>12 luni</option>
                    <option value={24}>24 luni</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Rezultat ITP <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={INPUT_CLS + ' bg-white'}
                  >
                    {([
                      { value: 'PASSED', label: 'Promovat' },
                      { value: 'FAILED', label: 'Respins' },
                      { value: 'RECHECK', label: 'Reverificare' },
                    ] as { value: ItpStatus; label: string }[]).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Kilometraj</label>
                  <input
                    type="number"
                    name="mileage"
                    inputMode="numeric"
                    value={form.mileage ?? ''}
                    onChange={handleChange}
                    placeholder="ex: 120000"
                    min={0}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {(inspectors.length > 0 || form.inspector) && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Inspector</label>
                  <select name="inspector" value={form.inspector ?? ''} onChange={handleChange} className={INPUT_CLS + ' bg-white'}>
                    <option value="">— nespecificat —</option>
                    {/* un inspector scos intre timp din lista ramane vizibil la editare */}
                    {form.inspector && !inspectors.includes(form.inspector) && <option value={form.inspector}>{form.inspector}</option>}
                    {inspectors.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Preț (RON)</label>
                <input
                  type="number"
                  name="price"
                  inputMode="decimal"
                  value={form.price ?? ''}
                  onChange={handleChange}
                  placeholder="ex: 150"
                  min={0}
                  step="0.01"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Observații</label>
                <textarea
                  name="observations"
                  value={form.observations}
                  onChange={handleChange}
                  placeholder="Note tehnice, deficiențe constatate..."
                  rows={3}
                  className={INPUT_CLS + ' resize-none'}
                />
              </div>
              <div className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDeadlines((v) => !v)}
                  aria-expanded={showDeadlines}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-600"
                >
                  <span>
                    Alte scadențe{' '}
                    <span className="font-normal text-slate-400">
                      {!showDeadlines && deadlineSummary(deadlines) ? deadlineSummary(deadlines) : '(opțional: RCA, rovinietă, tahograf)'}
                    </span>
                  </span>
                  {showDeadlines ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
                </button>
                {showDeadlines && (
                  <div className="px-3 pb-3 space-y-2">
                    <DeadlineFields
                      value={deadlines}
                      onChange={(d) => {
                        setDeadlines(d);
                        setDeadlinesTouched(true);
                      }}
                      inputCls={INPUT_CLS}
                    />
                    <p className="text-xs text-slate-400">Apar în „De contactat” cu 30 de zile înainte de expirare.</p>
                  </div>
                )}
              </div>
              <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!form.reminderConsent}
                  onChange={(e) => setForm((f) => ({ ...f, reminderConsent: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Clientul este de acord să primească remindere (ITP, RCA, rovinietă) prin SMS / WhatsApp
                  {declined && !form.reminderConsent && (
                    <span className="block text-xs text-amber-700 mt-0.5">
                      A cerut să nu mai primească mesaje. Bifați doar dacă și-a dat din nou acordul.
                    </span>
                  )}
                </span>
              </label>
            </fieldset>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Anulează
          </button>
          <button
            form="add-itp-form"
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}
