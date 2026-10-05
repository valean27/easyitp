import { describe, expect, it } from 'vitest';
import { reviewMessage } from './review';

describe('reviewMessage', () => {
  it('names the client and the station', () => {
    expect(reviewMessage('Ana', 'ITP Sud', 'https://g.page/r/x/review')).toBe(
      'Bună ziua, Ana! Vă mulțumim că ați ales ITP Sud. Dacă ați fost mulțumit, ne ajută mult o recenzie: https://g.page/r/x/review'
    );
  });

  it('works without name or station', () => {
    expect(reviewMessage(null, null, 'https://g.page/r/x/review')).toBe(
      'Bună ziua! Vă mulțumim că ați ales stația noastră. Dacă ați fost mulțumit, ne ajută mult o recenzie: https://g.page/r/x/review'
    );
  });
});
