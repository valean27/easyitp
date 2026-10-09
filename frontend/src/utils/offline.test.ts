import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { clearOffline, isNetworkError, loadToday, saveToday, savedTime } from './offline';
import { isIos, keyBytes } from './device';

// Testele ruleaza in Node: un localStorage simplu in memorie
class MemoryStorage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.items.set(k, String(v));
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
  clear() {
    this.items.clear();
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('offline', () => {
  afterEach(() => localStorage.clear());

  it('keeps only today and only for the same account', () => {
    saveToday('agenda', 'ana@itp.ro', '2026-10-09', [{ id: 1 }], new Date(2026, 9, 9, 14, 32));
    expect(loadToday('agenda', 'ana@itp.ro', '2026-10-09')?.data).toEqual([{ id: 1 }]);
    expect(savedTime(loadToday('agenda', 'ana@itp.ro', '2026-10-09')!.savedAt)).toBe('14:32');
    expect(loadToday('agenda', 'ana@itp.ro', '2026-10-10')).toBeNull();
    expect(loadToday('agenda', 'ion@itp.ro', '2026-10-09')).toBeNull();
  });

  it('clears everything on logout but leaves other keys', () => {
    localStorage.setItem('easyitp_theme', 'dark');
    saveToday('agenda', 'ana@itp.ro', '2026-10-09', []);
    clearOffline();
    expect(loadToday('agenda', 'ana@itp.ro', '2026-10-09')).toBeNull();
    expect(localStorage.getItem('easyitp_theme')).toBe('dark');
  });

  it('tells network errors from server errors', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isNetworkError({ response: { status: 500 }, code: 'ERR_BAD_RESPONSE' })).toBe(false);
  });
});

describe('device', () => {
  it('decodes the VAPID key and recognizes iOS', () => {
    expect(Array.from(keyBytes('BAEC'))).toEqual([4, 1, 2]);
    expect(keyBytes('A'.repeat(87)).length).toBe(65);
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14)', 5)).toBe(false);
  });
});
