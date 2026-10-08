import { CalendarPlus, Download } from 'lucide-react';

// "Adauga in calendar": Google Calendar (link) si fisierul .ics (telefon, Outlook, Apple)
export default function AddToCalendar({ googleUrl, icsUrl }: { googleUrl: string | null; icsUrl: string | null }) {
  if (!googleUrl && !icsUrl) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {googleUrl && (
        <a
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <CalendarPlus size={15} /> Google Calendar
        </a>
      )}
      {icsUrl && (
        <a
          href={icsUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download size={15} /> Calendar telefon (.ics)
        </a>
      )}
    </div>
  );
}
