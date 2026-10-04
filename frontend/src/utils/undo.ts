// Oferta "Anulează" dupa o stergere: o singura bara pe ecran (cea mai noua stergere o inlocuieste pe cea veche)
export const UNDO_VISIBLE_MS = 10_000;

export interface UndoOffer {
  key: number;
  message: string;
  eventId: number;
  // pagina isi reincarca datele dupa restaurare
  onUndone?: () => void;
}

type Listener = (offer: UndoOffer | null) => void;

const listeners = new Set<Listener>();
let current: UndoOffer | null = null;
let counter = 0;

function emit(offer: UndoOffer | null) {
  current = offer;
  listeners.forEach((l) => l(offer));
}

export function offerUndo(message: string, eventId: number | null, onUndone?: () => void) {
  if (eventId == null) return;
  emit({ key: ++counter, message, eventId, onUndone });
}

export function dismissUndo(key?: number) {
  if (key === undefined || current?.key === key) emit(null);
}

export function currentUndo(): UndoOffer | null {
  return current;
}

export function subscribeUndo(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
