import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarPlus, CalendarX, CalendarClock, ClipboardCheck, UserX, CheckCheck, X, Loader2, CloudOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getInbox, getUnreadCount, markAllNotificationsRead, markNotificationRead, type AppNotification, type NotificationKind } from '../api/notificationApi';
import { NOTIFICATION_LABELS, badge, timeAgo } from '../utils/notifications';

const POLL_MS = 60_000;

const KIND_STYLE: Record<NotificationKind, { icon: LucideIcon; cls: string }> = {
  NEW_BOOKING: { icon: CalendarPlus, cls: 'bg-purple-100 text-purple-700' },
  CLIENT_MOVED: { icon: CalendarClock, cls: 'bg-blue-100 text-blue-700' },
  CLIENT_CANCELLED: { icon: CalendarX, cls: 'bg-slate-200 text-slate-700' },
  INSPECTOR_ITP: { icon: ClipboardCheck, cls: 'bg-green-100 text-green-700' },
  INSPECTOR_NO_SHOW: { icon: UserX, cls: 'bg-orange-100 text-orange-700' },
  SYNC_CONFLICT: { icon: CloudOff, cls: 'bg-red-100 text-red-700' },
};

// Clopotelul statiei: numarul de notificari necitite (cerut la un minut si cand revii in fereastra) si lista lor.
// placement: "sidebar" = panoul se deschide langa meniul lateral; "top" = sub bara de sus (telefon)
export default function NotificationBell({ placement }: { placement: 'sidebar' | 'top' }) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  // pozitia butonului la deschidere (panoul e in document.body)
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const refreshCount = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    getUnreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    document.addEventListener('visibilitychange', refreshCount);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshCount);
    };
  }, [refreshCount]);

  const toggle = () => {
    const next = !open;
    setAnchor(buttonRef.current?.getBoundingClientRect() ?? null);
    setOpen(next);
    if (next) {
      setItems(null);
      getInbox()
        .then((inbox) => {
          setItems(inbox.items);
          setUnread(inbox.unread);
        })
        .catch(() => setItems([]));
    }
  };

  // click in afara sau Escape inchide panoul
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.read) {
      markNotificationRead(n.id).catch(() => undefined);
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const readAll = () => {
    markAllNotificationsRead().catch(() => undefined);
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
  };

  const count = badge(unread);
  const rect = anchor;
  const panelStyle: React.CSSProperties =
    placement === 'sidebar' && rect
      ? { position: 'fixed', top: Math.max(8, rect.top), left: rect.right + 8, width: 380 }
      : // pe telefon: sub bara de sus (h-11 = 44px)
        { position: 'fixed', top: 50, left: 8, right: 8 };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notificări: ${unread} necitite` : 'Notificări'}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell size={18} />
        {count && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-600 text-[10px] font-bold leading-[1.15rem] text-white text-center">
            {count}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notificări"
            style={panelStyle}
            className="z-[60] max-h-[70vh] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-800">
                Notificări {unread > 0 && <span className="font-normal text-slate-500">· {unread} necitite</span>}
              </p>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button type="button" onClick={readAll} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                    <CheckCheck size={14} /> Toate citite
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Închide">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items === null ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                  <Loader2 size={16} className="animate-spin mr-2" /> Se încarcă...
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  Nicio notificare. Aici apar programările online, cele anulate sau mutate de clienți și ITP-urile făcute de inspectori.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => {
                    const style = KIND_STYLE[n.kind] ?? KIND_STYLE.NEW_BOOKING;
                    const Icon = style.icon;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-blue-50/60'}`}
                        >
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.cls}`}>
                            <Icon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{NOTIFICATION_LABELS[n.kind] ?? n.kind}</span>
                              <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                            </span>
                            <span className={`block text-sm ${n.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span>
                            {n.body && <span className="block text-xs text-slate-500">{n.body}</span>}
                          </span>
                          {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="necitită" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
