import { useState } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  // Randul suplimentar din tooltip (ex. "12 ITP · 92% promovate")
  detail?: string;
}

interface Props {
  data: BarDatum[];
  formatValue: (v: number) => string;
  height?: number;
  color?: string;
}

const WIDTH = 640;
const PAD = { top: 12, right: 8, bottom: 24, left: 52 };
const RADIUS = 4;

// Gradatiile axei: pas rotund (1, 2, 5 x 10^n), cel mult 4 intervale
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp);
  const count = Math.ceil(max / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

// Bara cu colturile de sus rotunjite si baza dreapta pe axa
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// Grafic cu o singura serie: bare subtiri, grila discreta, tooltip la hover/tap
export default function BarChart({ data, formatValue, height = 220, color = '#2563eb' }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  const max = ticks[ticks.length - 1];
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const hovered = hover !== null ? data[hover] : null;
  const tooltipLeft = hover !== null ? ((PAD.left + slot * hover + slot / 2) / WIDTH) * 100 : 0;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-auto" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize={11}>
              {formatValue(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const h = (d.value / max) * plotH;
          return (
            <g key={d.label}>
              <path d={barPath(x, y(d.value), barW, h)} fill={color} opacity={hover === null || hover === i ? 1 : 0.35} />
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="fill-slate-500" fontSize={11}>
                {d.label}
              </text>
              {/* Zona de hover mai mare decat bara */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{ left: `${Math.min(88, Math.max(12, tooltipLeft))}%` }}
        >
          <div className="text-slate-300">{hovered.label}</div>
          <div className="font-semibold">{formatValue(hovered.value)}</div>
          {hovered.detail && <div className="text-slate-300">{hovered.detail}</div>}
        </div>
      )}
    </div>
  );
}
