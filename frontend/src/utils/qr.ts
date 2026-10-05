import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Codul QR ca SVG (fara imagini externe; merge si la tiparire). null pana e gata sau fara text.
export function useQr(text: string | null): string | null {
  const [svg, setSvg] = useState<{ text: string; svg: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then((s) => setSvg({ text, svg: s }))
      .catch(() => setSvg(null));
  }, [text]);
  return text && svg?.text === text ? svg.svg : null;
}
