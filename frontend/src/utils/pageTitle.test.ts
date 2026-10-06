import { describe, expect, it } from 'vitest';
import { pageTitle } from './pageTitle';

describe('pageTitle', () => {
  it('adds the brand after the page name', () => {
    expect(pageTitle('Stații ITP cu programare online')).toBe('Stații ITP cu programare online | Easy ITP');
    expect(pageTitle(null)).toContain('Easy ITP –');
  });
});
