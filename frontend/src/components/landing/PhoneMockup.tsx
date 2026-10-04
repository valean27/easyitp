import { CalendarCheck, MessageSquareText } from 'lucide-react';

// Telefonul din prima sectiune: SMS-ul de reamintire si notificarea programarii online care urmeaza
// (statie si client de exemplu; textul are forma reala a SMS-ului trimis de aplicatie)
export default function PhoneMockup() {
  const host = window.location.host;
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[3rem] bg-blue-500/20 blur-3xl" />
      <div className="relative rounded-[2.5rem] border-[10px] border-[#0f172a] bg-[#0f172a] shadow-2xl">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-4 w-20 rounded-full bg-black/80" />
        <div className="rounded-[1.8rem] bg-[#f1f5f9] dark:bg-[#111827] overflow-hidden pt-8 pb-5 px-3 min-h-[470px] space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
              <MessageSquareText size={15} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#0f172a] dark:text-[#f1f5f9]">ITP Exemplu</p>
              <p className="text-[10px] text-[#64748b]">SMS · acum</p>
            </div>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-[#1f2937] px-3 py-2.5 text-[12px] leading-snug text-[#1e293b] dark:text-[#e2e8f0] shadow-sm">
            ITP Exemplu: ITP-ul pentru CJ 12 ABC expira pe 14.11.2026. Programari la 0722 111 222. Online:
            <span className="text-blue-600 dark:text-[#60a5fa] break-all"> {host}/programare/itp-exemplu</span>
            <span className="block mt-1 text-[#64748b] break-all">Dezabonare: {host}/stop/…</span>
          </div>
          <div className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-[12px] text-white shadow-sm">
            Mersi, mă programez acum 👍
          </div>
          <div className="mt-6 rounded-2xl bg-white/90 dark:bg-[#1f2937] p-3 shadow-lg border border-[#e2e8f0] dark:border-[#334155]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#dcfce7] text-[#15803d] flex items-center justify-center">
                <CalendarCheck size={14} />
              </div>
              <p className="text-[11px] font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Programare online nouă</p>
            </div>
            <p className="mt-1.5 text-[11px] text-[#475569] dark:text-[#94a3b8]">
              Ion Popescu · CJ 12 ABC · joi, 12 nov, 10:20 · Autoturism
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
