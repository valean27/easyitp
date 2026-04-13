import { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import type { SingleValue } from 'react-select';
import { X, Loader2 } from 'lucide-react';
import type { ItpFormData } from '../types';
import { createItpEntry } from '../api/itpApi';
import { getMakes, createMake, getModels, createModel } from '../api/carApi';
import type { CarMake, CarModel } from '../api/carApi';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type SelectOption = { value: number; label: string };

const CURRENT_YEAR = new Date().getFullYear();

const rsStyles = {
  control: (base: object, state: { isFocused: boolean }) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? 'transparent' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px #3b82f6' : '0 0 0 1px #e2e8f0',
    fontSize: '0.875rem',
    minHeight: '38px',
    '&:hover': { borderColor: '#cbd5e1' },
  }),
  option: (base: object, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    fontSize: '0.875rem',
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
    color: state.isSelected ? 'white' : '#1e293b',
    cursor: 'pointer',
  }),
  menu: (base: object) => ({ ...base, borderRadius: '0.5rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,.1)' }),
  placeholder: (base: object) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
  singleValue: (base: object) => ({ ...base, fontSize: '0.875rem', color: '#1e293b' }),
};

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

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
};

export default function AddItpModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState<ItpFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [makeOptions, setMakeOptions] = useState<SelectOption[]>([]);
  const [modelOptions, setModelOptions] = useState<SelectOption[]>([]);
  const [selectedMake, setSelectedMake] = useState<SingleValue<SelectOption>>(null);
  const [selectedModel, setSelectedModel] = useState<SingleValue<SelectOption>>(null);
  const [makesLoading, setMakesLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    getMakes()
      .then((data: CarMake[]) =>
        setMakeOptions(data.map((m) => ({ value: m.id, label: m.name })))
      )
      .catch(() => setMakeOptions([]))
      .finally(() => setMakesLoading(false));
  }, []);

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
    const created = await createModel(inputValue, selectedMake.value);
    const opt: SelectOption = { value: created.id, label: created.name };
    setModelOptions((prev) => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)));
    setSelectedModel(opt);
    setForm((prev) => ({ ...prev, model: created.name }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'validityMonths'
          ? Number(value)
          : name === 'year'
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
      await createItpEntry(form);
      onSuccess();
      onClose();
    } catch {
      setError('A apărut o eroare. Verificați datele și încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Adaugă Înregistrare ITP</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="add-itp-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Driver */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Date Șofer
              </legend>
              <div className="grid grid-cols-2 gap-3">
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
                    type="text"
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
              <div className="grid grid-cols-2 gap-3">
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
                    styles={rsStyles}
                  />
                </div>
              </div>

              {/* Year + License plate row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    An fabricație
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={form.year ?? ''}
                    onChange={handleChange}
                    placeholder={String(CURRENT_YEAR)}
                    min={1900}
                    max={CURRENT_YEAR + 1}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Nr. Înmatriculare <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="licensePlate"
                    required
                    value={form.licensePlate}
                    onChange={handleChange}
                    placeholder="B 123 ABC"
                    className={INPUT_CLS + ' uppercase'}
                  />
                </div>
              </div>

              {/* VIN */}
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
            </fieldset>

            {/* ITP data */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Date ITP
              </legend>
              <div className="grid grid-cols-2 gap-3">
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
            </fieldset>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Anulează
          </button>
          <button
            form="add-itp-form"
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}
