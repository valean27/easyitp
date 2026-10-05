import { Star } from 'lucide-react';

const formatRating = (r: number) => r.toFixed(1).replace('.', ',');

// Nota de pe Google: 5 stele umplute proportional, nota si numarul de recenzii (cu atribuirea ceruta de Google)
export default function StarRating({ rating, count, href }: { rating: number; count: number | null; href?: string | null }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const stars = (cls: string, fill: boolean) => (
    <span className={`flex ${cls}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={16} strokeWidth={1.5} fill={fill ? 'currentColor' : 'none'} className="shrink-0" />
      ))}
    </span>
  );
  const body = (
    <>
      <span className="font-bold text-slate-800 tabular-nums">{formatRating(rating)}</span>
      <span className="relative inline-flex" role="img" aria-label={`${formatRating(rating)} din 5 stele`}>
        {stars('text-slate-300', false)}
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
          {stars('text-amber-400', true)}
        </span>
      </span>
      {count != null && (
        <span className="text-slate-500">
          ({count.toLocaleString('ro-RO')} {count === 1 ? 'recenzie' : 'recenzii'} Google)
        </span>
      )}
    </>
  );
  const cls = 'inline-flex flex-wrap items-center gap-1.5 text-sm';
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} hover:underline`}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}
