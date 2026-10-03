import { Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Luminos', icon: Sun },
  { value: 'dark', label: 'Întunecat', icon: Moon },
  { value: 'system', label: 'Automat', icon: Monitor },
];

// Alegerea temei: luminoasa, intunecata sau dupa setarea dispozitivului
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Temă" className="flex gap-1 p-1 rounded-lg bg-slate-100">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={value === 'system' ? 'Automat (după setarea telefonului sau a calculatorului)' : label}
            onClick={() => setPreference(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
              compact ? 'py-1.5' : 'py-2'
            } ${active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={compact ? 14 : 15} />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
