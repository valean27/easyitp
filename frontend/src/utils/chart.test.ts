import { describe, expect, it } from 'vitest';
import { niceTicks } from './chart';

describe('niceTicks', () => {
  it('uses round steps that cover the maximum', () => {
    expect(niceTicks(4540)).toEqual([0, 2000, 4000, 6000]);
    expect(niceTicks(26)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never uses fractional steps for small values', () => {
    expect(niceTicks(1)).toEqual([0, 1]);
  });

  it('handles empty data', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
