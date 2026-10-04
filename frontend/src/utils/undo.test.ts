import { describe, expect, it } from 'vitest';
import { currentUndo, dismissUndo, offerUndo, subscribeUndo } from './undo';

describe('undo offers', () => {
  it('keeps only the newest offer and ignores deletes without a history entry', () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeUndo((o) => seen.push(o?.message ?? null));

    offerUndo('ITP șters', 1);
    offerUndo('Client șters', 2);
    offerUndo('Fără istoric', null);
    expect(currentUndo()?.eventId).toBe(2);

    // o bara veche care expira nu o inchide pe cea noua
    const newest = currentUndo()!.key;
    dismissUndo(newest - 1);
    expect(currentUndo()?.eventId).toBe(2);
    dismissUndo(newest);
    expect(currentUndo()).toBeNull();

    expect(seen).toEqual(['ITP șters', 'Client șters', null]);
    unsubscribe();
  });
});
