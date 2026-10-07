import { describe, expect, it } from 'vitest';
import { nearbyMapsUrl, nearbyQuery } from './nearbyMap';

describe('nearbyMap', () => {
  it('searches ITP stations in the city, with spaces cleaned up', () => {
    expect(nearbyQuery('  Cluj   Napoca ')).toBe('stație ITP Cluj Napoca');
  });

  it('builds the Google Maps search link with the query encoded', () => {
    expect(nearbyMapsUrl('Iași')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('stație ITP Iași')}`,
    );
  });
});
