import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOW_AFTER_MS, isNaturallySlow, isSlow, requestFinished, requestStarted, subscribeSlow } from './serverStatus';

describe('serverStatus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flags slow only after the threshold and clears when all requests finish', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeSlow((s) => seen.push(s));

    requestStarted();
    requestStarted();
    vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
    expect(isSlow()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isSlow()).toBe(true);

    requestFinished();
    expect(isSlow()).toBe(true);
    requestFinished();
    expect(isSlow()).toBe(false);
    expect(seen).toEqual([true, false]);
    unsubscribe();
  });

  it('fast requests never show the banner', () => {
    requestStarted();
    vi.advanceTimersByTime(500);
    requestFinished();
    vi.advanceTimersByTime(SLOW_AFTER_MS * 2);
    expect(isSlow()).toBe(false);
  });

  it('knows which calls are slow by nature', () => {
    expect(isNaturallySlow('/api/itp/scan-registration')).toBe(true);
    expect(isNaturallySlow('/api/itp/dashboard')).toBe(false);
  });
});
