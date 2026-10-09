import { useEffect, useState } from 'react';
import { OUTBOX_EVENT, load } from './outbox';
import { SYNCED_EVENT, SYNCING_EVENT, isSyncing } from './sync';

// Starea cozii offline: ce asteapta internetul, ce e de rezolvat, daca se sincronizeaza acum
export function useOutbox() {
  const [state, setState] = useState(() => ({ ...load(), syncing: isSyncing() }));
  useEffect(() => {
    const refresh = () => setState({ ...load(), syncing: isSyncing() });
    window.addEventListener(OUTBOX_EVENT, refresh);
    window.addEventListener(SYNCING_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, refresh);
      window.removeEventListener(SYNCING_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return state;
}

// Reincarca lista paginii dupa ce coada s-a trimis (programarile create offline primesc id-ul de pe server)
export function useOnSynced(reload: () => void) {
  useEffect(() => {
    window.addEventListener(SYNCED_EVENT, reload);
    return () => window.removeEventListener(SYNCED_EVENT, reload);
  }, [reload]);
}
