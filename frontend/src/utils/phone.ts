import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

// Aceleasi reguli ca PhoneNumbers.java (libphonenumber): fara prefix = numar romanesc, altfel cu prefixul tarii
// (+49 / 0049 ...). La programarea online trebuie sa fie de mobil (confirmarea vine prin SMS).
export interface PhoneCheck {
  ok: boolean;
  error: string | null;
  // "0722 123 456" sau "+49 1512 3456789"
  formatted: string | null;
  // tara, in romana (ex. "Germania"), doar pentru numerele din alta tara
  country: string | null;
}

const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames(['ro'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

export function checkMobile(raw: string): PhoneCheck {
  const input = raw.trim().startsWith('00') ? '+' + raw.trim().slice(2) : raw.trim();
  if (!input) return { ok: false, error: 'Introduceți numărul de telefon.', formatted: null, country: null };
  const foreign = input.startsWith('+');
  const number = parsePhoneNumberFromString(input, 'RO');
  if (!number || !number.isValid()) {
    return {
      ok: false,
      error: foreign
        ? 'Numărul nu este valid pentru țara lui. Verificați prefixul și cifrele.'
        : 'Numărul nu este valid. Verificați cifrele (ex. 0722 123 456); pentru alte țări scrieți-l cu prefixul țării (ex. +49 ...).',
      formatted: null,
      country: null,
    };
  }
  const type = number.getType();
  if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { ok: false, error: 'Introduceți un număr de mobil: confirmarea programării vine prin SMS.', formatted: null, country: null };
  }
  const ro = number.country === 'RO';
  return {
    ok: true,
    error: null,
    formatted: ro ? number.formatNational() : number.formatInternational(),
    country: ro || !number.country ? null : regionName(number.country),
  };
}
