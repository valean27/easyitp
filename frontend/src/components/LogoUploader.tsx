import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { deleteLogo, uploadLogo } from '../api/accountApi';
import { shrinkLogo } from '../utils/image';
import { assetUrl } from '../utils/apiUrl';
import { apiMessage } from '../utils/errors';

// Logo-ul statiei (Contul meu → Date statie): apare pe pagina de programare, in emailurile catre clienti si in lista de statii
export default function LogoUploader({ logoUrl, onChange }: { logoUrl: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError('Alegeți o imagine PNG sau JPG.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadLogo(await shrinkLogo(file)));
    } catch (err) {
      setError(apiMessage(err, 'Logo-ul nu a putut fi încărcat.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteLogo();
      onChange(null);
    } catch (err) {
      setError(apiMessage(err, 'Logo-ul nu a putut fi șters.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="block text-sm font-medium text-slate-600 mb-1">Logo</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
          {logoUrl ? (
            <img src={assetUrl(logoUrl)} alt="Logo-ul stației" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus size={22} className="text-slate-300" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {logoUrl ? 'Schimbă' : 'Încarcă logo'}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 size={14} /> Șterge
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <p className="text-xs text-slate-400 mt-1">
        PNG sau JPG, de preferat pătrat și pe fundal transparent sau alb. Apare pe pagina de programare, în emailurile către clienți și
        în lista de stații.
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
