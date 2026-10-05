import { useState } from 'react';
import { AlertTriangle, Check, Clock, Copy, Inbox, Loader2, MessageCircle, MessageSquare, Phone, PhoneOutgoing, RotateCcw } from 'lucide-react';
import type { DeadlineReminder, Profile } from '../types';
import { normalizePhone, smsLink, stopUrl, whatsappLink } from '../utils/reminderMessage';
import { deadlineMessage } from '../utils/deadlines';
import { formatDateRo } from '../utils/fleet';

const ACTION_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none';

const KIND_CLS: Record<DeadlineReminder['kind'], string> = {
  RCA: 'bg-violet-100 text-violet-700',
  ROVINIETA: 'bg-teal-100 text-teal-700',
  TAHOGRAF: 'bg-slate-200 text-slate-700',
};

function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertTriangle size={12} />
        Expirat de {Math.abs(days)} {Math.abs(days) === 1 ? 'zi' : 'zile'}
      </span>
    );
  }
  const cls = days <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Clock size={12} />
      {days === 0 ? 'Expiră azi' : `Expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`}
    </span>
  );
}

function DeadlineCard({
  item,
  profile,
  busy,
  onContacted,
}: {
  item: DeadlineReminder;
  profile: Profile | null;
  busy: boolean;
  onContacted: (item: DeadlineReminder, contacted: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const phone = normalizePhone(item.phone);
  const message = deadlineMessage({
    nume: item.clientName,
    numar: item.plate.toUpperCase(),
    tip: item.label,
    data: item.dueDate,
    expirat: item.daysLeft < 0,
    statie: profile?.stationName ?? null,
    telefon: profile?.phone ?? null,
    stop: item.stopToken ? stopUrl(item.stopToken) : null,
  });
  const mark = () => {
    if (!item.contactedAt) onContacted(item, true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil */
    }
  };
  const disabled = phone ? '' : 'opacity-40 pointer-events-none';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${KIND_CLS[item.kind]}`}>{item.label}</span>
          <span className="font-mono font-semibold text-slate-800">{item.plate.toUpperCase()}</span>
          <DaysBadge days={item.daysLeft} />
          {item.contactedAt && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              Contactat {formatDateRo(item.contactedAt.slice(0, 10))}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 mt-1">
          <span className="font-medium">{item.clientName}</span>
          <span className="text-slate-400"> · {[item.brand, item.model].filter(Boolean).join(' ')}</span>
          {item.autoSmsAt && (
            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 align-middle">
              SMS automat {formatDateRo(item.autoSmsAt.slice(0, 10))}
            </span>
          )}
          {item.consent !== 'GIVEN' && (
            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-medium text-slate-500 align-middle">
              fără acord
            </span>
          )}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.label} valabil până la {formatDateRo(item.dueDate)} · {item.phone || 'fără telefon'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={phone ? whatsappLink(phone, message) : undefined}
          target="_blank"
          rel="noreferrer"
          onClick={mark}
          className={`${ACTION_BTN} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${disabled}`}
        >
          <MessageCircle size={14} />
          WhatsApp
        </a>
        <a
          href={phone ? smsLink(phone, message) : undefined}
          onClick={mark}
          className={`${ACTION_BTN} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 ${disabled}`}
        >
          <MessageSquare size={14} />
          SMS
        </a>
        <a
          href={phone ? `tel:+${phone}` : undefined}
          onClick={mark}
          className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 ${disabled}`}
        >
          <Phone size={14} />
          Sună
        </a>
        <button onClick={copy} className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          {copied ? 'Copiat' : 'Copiază mesajul'}
        </button>
        {item.contactedAt ? (
          <button
            disabled={busy}
            onClick={() => onContacted(item, false)}
            className={`${ACTION_BTN} border-transparent text-slate-400 hover:text-slate-600`}
            title="Mută înapoi la De contactat"
          >
            <RotateCcw size={13} />
            Resetează
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => onContacted(item, true)}
            className={`${ACTION_BTN} border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700`}
          >
            <PhoneOutgoing size={13} />
            Contactat
          </button>
        )}
        {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
    </div>
  );
}

// "De contactat" -> Alte scadente: RCA, rovinieta, tahograf
export default function DeadlineReminderList({
  items,
  profile,
  busyKey,
  onContacted,
}: {
  items: DeadlineReminder[];
  profile: Profile | null;
  busyKey: string | null;
  onContacted: (item: DeadlineReminder, contacted: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 text-center">
        <Inbox size={40} className="opacity-30" />
        <p className="text-sm">Nicio scadență RCA, rovinietă sau tahograf în următoarele 30 de zile.</p>
        <p className="text-xs max-w-sm">Le puteți completa în formularul ITP („Alte scadențe”) sau în fișa clientului.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((d) => (
        <DeadlineCard
          key={`${d.vehicleId}-${d.kind}`}
          item={d}
          profile={profile}
          busy={busyKey === `${d.vehicleId}-${d.kind}`}
          onContacted={onContacted}
        />
      ))}
    </div>
  );
}
