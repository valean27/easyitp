import { useState } from 'react';
import type { Bar } from '../utils/inspectors';

// ITP-urile pe zi (sau pe luna), stivuite pe inspector. Culoarea tine de inspector; legenda si tabelul de
// sub grafic poarta numele, tooltip-ul arata defalcarea fiecarei bare.

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 36 };
const GAP = 2; // spatiu intre segmente
const RADIUS = 4;

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => v / s <= 5) ?? 10 * pow;
  return Math.ceil(v / step) * step;
}

// Segmentul de sus are colturile rotunjite; baza ramane dreapta pe axa
function segPath(x: number, y: number, w: number, h: number, top: boolean): string {
  if (h <= 0) return '';
  if (!top) return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

interface Props {
  bars: Bar[];
  colorOf: (key: string) => string;
  nameOf: (key: string) => string;
}

export default function InspectorStackedChart({ bars, colorOf, nameOf }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const width = typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 720;
  const max = niceMax(Math.max(0, ...bars.map((b) => b.total)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(28, slot * 0.6));
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(bars.length / (width < 500 ? 8 : 16));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const active = hover !== null ? bars[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="ITP-uri pe inspector" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-slate-200)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-slate-400)">
              {t}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          let acc = 0;
          return (
            <g key={i}>
              {b.segments.map((s, j) => {
                const top = y(acc + s.count);
                const bottom = y(acc);
                acc += s.count;
                const last = j === b.segments.length - 1;
                // spatiul de 2px dintre segmente: fiecare segment de deasupra altuia se scurteaza jos
                const h = Math.max(0, bottom - top - (j > 0 ? GAP : 0));
                return (
                  <path
                    key={s.key}
                    d={segPath(x, top, barW, h, last)}
                    fill={colorOf(s.key)}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                );
              })}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--color-slate-400)">
                  {b.label}
                </text>
              )}
              {/* tinta de hover mai mare decat bara */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-slate-300)" strokeWidth={1} />
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((PAD.left + (hover! + 0.5) * slot) / width) * 100}% - 80px), calc(100% - 170px))` }}
        >
          <p className="font-semibold text-slate-800">
            {active.title} · {active.total} ITP
          </p>
          {active.segments.length === 0 && <p className="text-slate-500">Niciun ITP</p>}
          {[...active.segments].reverse().map((s) => (
            <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(s.key) }} />
              <span className="flex-1 truncate">{nameOf(s.key)}</span>
              <span className="tabular-nums font-medium text-slate-800">{s.count}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
